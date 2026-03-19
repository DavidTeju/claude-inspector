<script lang="ts">
	import Composer from '$lib/components/Composer.svelte';
	import MessageThread from '$lib/components/MessageThread.svelte';
	import SessionControls from '$lib/components/SessionControls.svelte';
	import { SESSION_ID_DISPLAY_LENGTH } from '$lib/constants.js';
	import type { PermissionMode } from '$lib/shared/active-session-types.js';
	import { createSessionError, type SessionErrorInfo } from '$lib/shared/session-errors.js';
	import {
		createActiveSessionConnection,
		type ActiveSessionClient
	} from '$lib/stores/active-session.svelte.js';
	import { newSessionModal } from '$lib/stores/new-session-modal.svelte.js';
	import type { ThreadMessage } from '$lib/types.js';
	import { dirNameToDisplayName, getErrorMessage, uuid } from '$lib/utils.js';
	import { browser } from '$app/environment';

	let { data } = $props();

	type PageMode = 'idle' | 'connecting' | 'active' | 'closed';

	let session: ActiveSessionClient | undefined = $state();
	let localPermissionMode = $state<PermissionMode>('default');
	let resumeError = $state<SessionErrorInfo | null>(null);
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
				resumeError = createSessionError(body.error ?? 'Failed to resume session', 'action', true);
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
			resumeError = createSessionError(
				`Failed to resume session: ${getErrorMessage(err)}`,
				'network',
				true
			);
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
				error={session?.error ?? null}
				{resumeError}
				onRetry={async () => {
					await session?.retryLastPrompt();
				}}
				onStartNewSession={() => newSessionModal.show(data.projectId)}
			/>
		</div>

		<!-- Message area -->
		{#if pageMode === 'connecting'}
			<div class="flex flex-1 items-center justify-center">
				<div class="text-text-500 text-center text-sm">
					<div class="bg-accent-400 mx-auto mb-3 h-2 w-2 animate-pulse rounded-full"></div>
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
				class="border-surface-800 bg-surface-950/88 z-10 flex-shrink-0 border-t px-4 py-2 backdrop-blur-sm"
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

	{#if session?.networkNotice}
		<div class="animate-fade-in-up fixed right-4 bottom-4 z-30 max-w-sm">
			<div
				class="border-warning-500/30 bg-surface-950/95 text-warning-400 flex items-start gap-2.5 rounded-lg border px-4 py-3 shadow-lg backdrop-blur"
			>
				<svg
					class="mt-0.5 h-4 w-4 shrink-0"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="2"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.858 15.355-5.858 21.213 0"
					/>
				</svg>
				<div class="min-w-0 flex-1">
					<p class="text-[12px] leading-tight font-medium">Connection issue</p>
					<p class="text-warning-400/70 mt-0.5 text-[11px] leading-snug">
						{session.networkNotice.message}
					</p>
				</div>
				<button
					onclick={() => session?.dismissNetworkNotice()}
					class="text-warning-400/50 hover:text-warning-400 -mr-1 shrink-0 cursor-pointer transition-colors"
					aria-label="Dismiss"
				>
					<svg
						class="h-3.5 w-3.5"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="2"
					>
						<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>
		</div>
	{/if}
</div>
