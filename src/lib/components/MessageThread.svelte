<script lang="ts">
	import UserMessage from './UserMessage.svelte';
	import AssistantMessage from './AssistantMessage.svelte';
	import type { ThreadMessage, ContentSegment } from '$lib/types.js';

	type GroupedMessage = {
		message: ThreadMessage;
		additionalSegments: ContentSegment[];
	};

	let { messages }: { messages: ThreadMessage[] } = $props();

	let groupedMessages = $derived.by(() => {
		const groups: GroupedMessage[] = [];

		for (const msg of messages) {
			if (
				msg.role === 'assistant' &&
				groups.length > 0 &&
				groups[groups.length - 1].message.role === 'assistant'
			) {
				// Merge into previous assistant group
				groups[groups.length - 1].additionalSegments.push({
					thinkingBlocks: msg.thinkingBlocks,
					textContent: msg.textContent,
					toolCalls: msg.toolCalls
				});
			} else {
				groups.push({ message: msg, additionalSegments: [] });
			}
		}

		return groups;
	});
</script>

<div class="border-surface-800/50 space-y-6 border-l pl-6">
	{#each groupedMessages as group, i (group.message.uuid)}
		<div class="animate-fade-in-up relative" style="animation-delay: {Math.min(i, 10) * 40}ms">
			<!-- Timeline dot -->
			<div
				class="absolute top-4 -left-6 h-2 w-2 -translate-x-1/2 rounded-full {group.message.role ===
				'user'
					? 'bg-user-400'
					: 'bg-accent-400'}"
			></div>
			{#if group.message.role === 'user'}
				<UserMessage message={group.message} />
			{:else}
				<AssistantMessage message={group.message} additionalSegments={group.additionalSegments} />
			{/if}
		</div>
	{/each}
</div>
