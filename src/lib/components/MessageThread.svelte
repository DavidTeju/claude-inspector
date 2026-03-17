<script lang="ts">
	import { untrack } from 'svelte';
	import type { PermissionResponse } from '$lib/shared/active-session-types.js';
	import type { ActiveSessionClient } from '$lib/stores/active-session.svelte.js';
	import type { ThreadMessage } from '$lib/types.js';
	import AskUserQuestion from './AskUserQuestion.svelte';
	import MessageList from './MessageList.svelte';
	import PermissionBanner from './PermissionBanner.svelte';
	import StreamingAssistantMessage from './StreamingAssistantMessage.svelte';

	/**
	 * Unified message thread with scroll management.
	 *
	 * Always pass `messages` as the baseline message data.
	 * Optionally pass `session` to enable live features (streaming, permissions,
	 * auto-scroll on new content). When `session` is present, its messages take
	 * precedence — `messages` is ignored.
	 *
	 * `onPermission` and `onQuestion` are only used when `session` is present.
	 */
	let {
		session,
		messages: staticMessages,
		onPermission,
		onQuestion
	}: {
		messages: ThreadMessage[];
		session?: ActiveSessionClient;
		onPermission?: (response: PermissionResponse) => void;
		onQuestion?: (answers: Record<string, string | string[]>) => void;
	} = $props();

	let displayMessages = $derived(session ? session.messages : staticMessages);

	let containerEl: HTMLDivElement | undefined = $state();
	let isNearBottom = $state(true);
	let scrollPending = false;
	let scrollThrottled = false;
	let lastSessionId = '';

	function handleScroll() {
		if (scrollThrottled || !containerEl) return;
		scrollThrottled = true;
		requestAnimationFrame(() => {
			if (containerEl) {
				const threshold = 100;
				const { scrollTop, scrollHeight, clientHeight } = containerEl;
				isNearBottom = scrollHeight - scrollTop - clientHeight < threshold;
			}
			scrollThrottled = false;
		});
	}

	function scrollToBottom() {
		containerEl?.scrollTo({ top: containerEl.scrollHeight, behavior: 'smooth' });
	}

	// Reset isNearBottom when the session changes
	$effect(() => {
		if (session) {
			if (session.sessionId !== lastSessionId) {
				lastSessionId = session.sessionId;
				isNearBottom = true;
			}
		}
	});

	// Auto-scroll when new content arrives and user is near bottom.
	// Uses $effect.pre to run before DOM update; untrack isolates side-effect reads.
	$effect.pre(() => {
		if (session) {
			void session.messages;
			void session.streamingText;
			void session.streamingThinking;
			void session.streamingToolCalls.length;
			void session.pendingPermission;
			void session.pendingQuestion;
		}

		untrack(() => {
			if (isNearBottom && containerEl && !scrollPending) {
				scrollPending = true;
				requestAnimationFrame(() => {
					containerEl?.scrollTo({ top: containerEl.scrollHeight });
					scrollPending = false;
				});
			}
		});
	});
</script>

<div
	class="relative min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto"
	bind:this={containerEl}
	onscroll={handleScroll}
>
	<div class="space-y-6 p-6">
		<!-- Committed messages -->
		{#if displayMessages.length > 0}
			<MessageList messages={displayMessages} />
		{:else if !session}
			<div class="text-text-500 py-12 text-center text-sm">No messages in this session.</div>
		{/if}

		<!-- Streaming assistant message -->
		{#if session?.streamingUuid}
			<div class="border-surface-800/50 relative border-l pl-6">
				<div
					class="bg-accent-400 absolute top-4 -left-6 h-2 w-2 -translate-x-1/2 animate-pulse rounded-full"
				></div>
				<StreamingAssistantMessage
					text={session.streamingText}
					thinking={session.streamingThinking}
					toolCalls={session.streamingToolCalls}
					model={session.streamingModel}
				/>
			</div>
		{/if}

		<!-- Permission banner -->
		{#if session?.pendingPermission}
			{@const permissionId = session.pendingPermission.id}
			<div class="pl-6">
				<PermissionBanner
					request={session.pendingPermission}
					onAllow={(queuedNote) => {
						onPermission?.({
							toolUseId: permissionId,
							behavior: 'allow',
							queuedNote
						});
					}}
					onDeny={(message) => {
						onPermission?.({
							toolUseId: permissionId,
							behavior: 'deny',
							message
						});
					}}
				/>
			</div>
		{/if}

		<!-- Ask user question -->
		{#if session?.pendingQuestion}
			<div class="pl-6">
				<AskUserQuestion
					request={session.pendingQuestion}
					onSubmit={(answers) => onQuestion?.(answers)}
				/>
			</div>
		{/if}
	</div>

	<!-- Jump to bottom button -->
	{#if !isNearBottom}
		<button
			onclick={scrollToBottom}
			class="border-surface-700 bg-surface-800 text-text-300 hover:bg-surface-700 absolute bottom-4 left-1/2 -translate-x-1/2 cursor-pointer rounded-full border px-3 py-1.5 text-[10px] shadow-lg transition-colors"
		>
			Jump to bottom
		</button>
	{/if}
</div>
