<script lang="ts">
	import { STAGGER_DELAY_MS, STAGGER_BASE_MS } from '$lib/constants.js';
	import type { ThreadMessage, ContentSegment } from '$lib/types.js';
	import AssistantMessage from './AssistantMessage.svelte';
	import UserMessage from './UserMessage.svelte';

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

<div class="space-y-2">
	{#each groupedMessages as group, i (group.message.uuid)}
		<div
			class="animate-fade-in-up"
			style="animation-delay: {Math.min(i, STAGGER_DELAY_MS) * STAGGER_BASE_MS}ms"
		>
			{#if group.message.role === 'user'}
				<UserMessage message={group.message} />
			{:else}
				<AssistantMessage message={group.message} additionalSegments={group.additionalSegments} />
			{/if}
		</div>
	{/each}
</div>
