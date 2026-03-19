<script lang="ts">
	import type { ImageContentBlock, ThreadMessage } from '$lib/types.js';
	import { formatTime } from '$lib/utils.js';

	let {
		message
	}: {
		message: ThreadMessage;
	} = $props();

	let imageBlocks: ImageContentBlock[] = $derived(
		Array.isArray(message.rawContent)
			? message.rawContent.filter(
					(b): b is ImageContentBlock => b.type === 'image' && !!b.source.data
				)
			: []
	);
</script>

<div class="chat chat-end">
	<div class="chat-header text-xs opacity-50">
		You
		<time class="text-[10px]">{formatTime(message.timestamp)}</time>
	</div>
	<div
		class="chat-bubble chat-bubble-secondary text-sm leading-relaxed break-words whitespace-pre-wrap"
	>
		{#if message.textContent}
			{message.textContent}
		{/if}
		{#each imageBlocks as block (block)}
			<img
				src="data:{block.source.mediaType};base64,{block.source.data}"
				alt="User-submitted screenshot"
				class="max-w-full rounded-lg"
			/>
		{/each}
	</div>
</div>
