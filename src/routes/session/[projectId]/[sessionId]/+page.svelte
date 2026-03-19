<script lang="ts">
	import Composer from '$lib/components/Composer.svelte';
	import MessageThread from '$lib/components/MessageThread.svelte';
	import SessionControls from '$lib/components/SessionControls.svelte';
	import { SESSION_ID_DISPLAY_LENGTH } from '$lib/constants.js';
	import type { PermissionMode } from '$lib/shared/active-session-types.js';
	import {
		createActiveSessionConnection,
		type ActiveSessionClient
	} from '$lib/stores/active-session.svelte.js';
	import type { ThreadMessage } from '$lib/types.js';
	import { dirNameToDisplayName, getErrorMessage, uuid } from '$lib/utils.js';
	import { browser } from '$app/environment';

	let { data } = $props();

	type PageMode = 'idle' | 'connecting' | 'active' | 'closed';

	let session: ActiveSessionClient | undefined = $state();
	let localPermissionMode = $state<PermissionMode>('default');
	let resumeError = $state<string | null>(null);
	let resuming = $state(false);

	// Local override — set to true after a successful resume so the SSE connection
	// survives until SvelteKit re-runs the server load with the real isActive flag.
	let activatedLocally = $state(false);

	// Plain (non-reactive) variable — holds optimistic user message from the idle/closed
	// resume flow. This still exists even though the server now writes the resumed prompt
	// into messageBuffer immediately: it covers the short client-side gap between the
	// successful POST /start response and the first SSE replay snapshot for the reactivated
	// session. Once replay attaches, client UUID dedup keeps the canonical server message.
	let pendingResumeMessage: ThreadMessage | null = null;

	// Derive page mode from session state and server data
	let pageMode = $derived.by((): PageMode => {
		if (!session) {
			return data.isActive || activatedLocally ? 'connecting' : 'idle';
		}
		const s = session.state;
		if (s === 'closed' || s === 'error') return 'closed';
		return 'active';
	});

	let isLive = $derived(pageMode === 'active');
	let isRunning = $derived(session?.state === 'running' || session?.state === 'compacting');
	let isQueuing = $derived(isRunning);
	let canResume = $derived(!data.isSubagent);
	let showComposer = $derived(isLive || canResume);
	let composerDisabled = $derived(
		resuming || session?.state === 'awaiting_permission' || session?.state === 'awaiting_input'
	);

	let sessionTitle = $derived(
		data.summary ||
			data.firstPrompt ||
			'Session ' + data.sessionId.slice(0, SESSION_ID_DISPLAY_LENGTH)
	);
	let displayModel = $derived(session?.model || data.messages[0]?.model || '');
	let currentPermissionMode = $derived(session ? session.permissionMode : localPermissionMode);

	let buttonLabel = $derived.by(() => {
		if (pageMode === 'idle' || pageMode === 'closed') return 'Resume';
		if (isQueuing) return 'Queue';
		return 'Send';
	});

	// Connect to SSE when session is active (from server data or after resume)
	$effect(() => {
		if (!browser) return;

		// Read sessionId to re-run on navigation
		const sid = data.sessionId;
		const shouldConnect = data.isActive || activatedLocally;

		if (shouldConnect) {
			// If we just resumed locally, seed the connection with the optimistic resume
			// message so the thread stays populated until replay catches up from the server.
			const seedMessages = pendingResumeMessage
				? [...data.messages, pendingResumeMessage]
				: data.messages;
			pendingResumeMessage = null;
			const connection = createActiveSessionConnection(sid, seedMessages);
			session = connection;

			return () => {
				session = undefined;
				connection.disconnect();
			};
		}

		// Not active — reset session
		session = undefined;
		return undefined;
	});

	// Reset local override when navigating to a different session
	$effect(() => {
		void data.sessionId;
		activatedLocally = false;
	});

	async function handleSubmit(prompt: string) {
		if (pageMode === 'active' && session) {
			// Send or queue to active session
			await session.send(prompt);
			return;
		}

		// Resume flow (idle or closed)
		resuming = true;
		resumeError = null;

		try {
			const response = await fetch('/api/session/start', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					projectId: data.projectId,
					prompt,
					sdkSessionId: data.sessionId,
					permissionMode: localPermissionMode
				})
			});

			const body: { error?: string } = await response.json();
			if (!response.ok) {
				resumeError = body.error ?? 'Failed to resume session';
				return;
			}

			// Disconnect old connection if any (e.g. session was in 'closed' state)
			session?.disconnect();

			// Create a short-lived optimistic user message for the local resume handoff.
			// The server-side messageBuffer now guarantees the replay/source-of-truth copy.
			pendingResumeMessage = {
				uuid: uuid(),
				role: 'user',
				timestamp: new Date().toISOString(),
				textContent: prompt,
				toolCalls: [],
				thinkingBlocks: [],
				rawContent: prompt,
				model: undefined
			};

			// Trigger the $effect to create a new SSE connection
			activatedLocally = true;
		} catch (err: unknown) {
			console.error('[session] Resume failed:', err);
			resumeError = `Failed to resume session: ${getErrorMessage(err)}`;
		} finally {
			resuming = false;
		}
	}

	function handlePermissionModeChange(mode: PermissionMode) {
		if (session) {
			session.setPermissionMode(mode);
		} else {
			localPermissionMode = mode;
		}
	}
</script>

<svelte:head>
	<title>{sessionTitle} — {dirNameToDisplayName(data.projectId)} — Claude Inspector</title>
</svelte:head>

<div
	class="-m-5 flex h-[calc(100%+2.5rem)] min-h-0 flex-col md:-m-6 md:h-[calc(100%+3rem)] lg:-m-8 lg:h-[calc(100%+4rem)] {isRunning
		? 'session-live-border'
		: ''}"
>
	{#key data.sessionId}
		<!-- Controls bar -->
		<div class="flex-shrink-0 p-4 pb-0">
			<SessionControls
				{sessionTitle}
				sessionId={data.sessionId}
				projectId={data.projectId}
				model={displayModel}
				messageCount={session ? session.messages.length : data.messages.length}
				permissionMode={currentPermissionMode}
				onPermissionModeChange={handlePermissionModeChange}
				dangerousPermissionsAllowed={session ? session.dangerousPermissionsAllowed : true}
				isActive={isLive}
				sessionState={session?.state}
				cost={session?.cost}
				onInterrupt={() => session?.interrupt()}
				showResumeCommand={canResume}
				isSubagent={data.isSubagent}
				parentSessionId={data.parentSessionId}
				reconnecting={session?.reconnecting ?? false}
				error={session?.error ?? ''}
				resumeError={resumeError ?? ''}
			/>
		</div>

		<!-- Message area -->
		{#if pageMode === 'connecting'}
			<div class="flex flex-1 items-center justify-center">
				<div class="text-muted-foreground text-center text-sm">
					<div class="bg-primary mx-auto mb-3 h-2 w-2 animate-pulse rounded-full"></div>
					Connecting...
				</div>
			</div>
		{:else}
			<MessageThread
				{session}
				messages={data.messages}
				onPermission={(response) => session?.respondPermission(response)}
				onQuestion={(answers) => session?.respondQuestion(answers)}
			/>
		{/if}

		<!-- Composer (visible for resumable sessions and active sessions) -->
		{#if showComposer}
			<div
				class="border-border bg-background/88 z-10 flex-shrink-0 border-t px-4 py-2 backdrop-blur-sm"
			>
				<Composer
					onSubmit={handleSubmit}
					disabled={composerDisabled}
					{isQueuing}
					{buttonLabel}
					suggestion={session?.promptSuggestion ?? ''}
					slashCommands={session?.slashCommands ?? []}
					draftKey={`session-${data.sessionId}`}
				/>
			</div>
		{/if}
	{/key}
</div>
