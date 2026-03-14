<script lang="ts">
	import MessageThread from './MessageThread.svelte';
	import StreamingAssistantMessage from './StreamingAssistantMessage.svelte';
	import PermissionBanner from './PermissionBanner.svelte';
	import AskUserQuestion from './AskUserQuestion.svelte';
	import type { ActiveSessionClient } from '$lib/stores/active-session.svelte.js';
	import type { PermissionResponse } from '$lib/shared/active-session-types.js';

	let {
		session,
		onPermission,
		onQuestion
	}: {
		session: ActiveSessionClient;
		onPermission: (response: PermissionResponse) => void;
		onQuestion: (answers: Record<string, string | string[]>) => void;
	} = $props();

	let containerEl: HTMLDivElement | undefined = $state();
	let isNearBottom = $state(true);
	let scrollPending = false;
	let scrollThrottled = false;

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

	// Auto-scroll when new content arrives and user is near bottom
	$effect(() => {
		void session.messages;
		void session.streamingText;
		void session.pendingPermission;
		void session.pendingQuestion;

		if (isNearBottom && containerEl && !scrollPending) {
			scrollPending = true;
			requestAnimationFrame(() => {
				containerEl?.scrollTo({ top: containerEl.scrollHeight });
				scrollPending = false;
			});
		}
	});
</script>

<div class="relative flex-1 overflow-y-auto" bind:this={containerEl} onscroll={handleScroll}>
	<div class="space-y-6 p-6">
		<!-- Committed messages -->
		{#if session.messages.length > 0}
			<MessageThread messages={session.messages} />
		{/if}

		<!-- Streaming assistant message -->
		{#if session.streamingUuid}
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
		{#if session.pendingPermission}
			{@const permissionId = session.pendingPermission.id}
			<div class="pl-6">
				<PermissionBanner
					request={session.pendingPermission}
					onAllow={(queuedNote) => {
						onPermission({
							toolUseId: permissionId,
							behavior: 'allow',
							queuedNote
						});
					}}
					onDeny={(message) => {
						onPermission({
							toolUseId: permissionId,
							behavior: 'deny',
							message
						});
					}}
				/>
			</div>
		{/if}

		<!-- Ask user question -->
		{#if session.pendingQuestion}
			<div class="pl-6">
				<AskUserQuestion
					request={session.pendingQuestion}
					onSubmit={(answers) => onQuestion(answers)}
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
