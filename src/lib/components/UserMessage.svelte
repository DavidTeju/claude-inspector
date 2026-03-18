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

<div class="flex justify-end">
	<div
		class="border-l-user-400/40 bg-user-700/40 max-w-[85%] rounded-xl rounded-br-md border-l-2 px-4 py-3"
	>
		<div class="mb-1.5 flex items-center justify-between gap-4">
			<span class="text-user-400 text-[10px] font-semibold tracking-wider uppercase">You</span>
			<span class="text-text-500 text-[10px]">{formatTime(message.timestamp)}</span>
		</div>
		{#if message.textContent}
			<div class="text-text-100 font-mono text-sm leading-relaxed break-words whitespace-pre-wrap">
				{message.textContent}
			</div>
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
