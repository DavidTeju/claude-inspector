<script lang="ts">
	import ToolCallGroup from './ToolCallGroup.svelte';
	import ThinkingBlock from './ThinkingBlock.svelte';
	import MarkdownContent from './MarkdownContent.svelte';
	import { formatTime } from '$lib/utils.js';
	import type { ToolCall, ThreadMessage, ContentSegment } from '$lib/types.js';

	type RenderItem =
		| { kind: 'thinking'; content: string }
		| { kind: 'text'; content: string }
		| { kind: 'tools'; tools: ToolCall[] };

	let {
		message,
		additionalSegments = []
	}: {
		message: ThreadMessage;
		additionalSegments?: ContentSegment[];
	} = $props();

	/** Flatten all segments into a render plan, merging consecutive tool batches. */
	let renderItems = $derived.by(() => {
		const items: RenderItem[] = [];

		function pushSegment(thinkingBlocks: string[], textContent: string, toolCalls: ToolCall[]) {
			for (const t of thinkingBlocks) {
				items.push({ kind: 'thinking', content: t });
			}
			if (textContent.trim()) {
				items.push({ kind: 'text', content: textContent });
			}
			if (toolCalls.length > 0) {
				const last = items.at(-1);
				if (last?.kind === 'tools') {
					// Merge with previous tools batch
					last.tools.push(...toolCalls);
				} else {
					items.push({ kind: 'tools', tools: [...toolCalls] });
				}
			}
		}

		pushSegment(message.thinkingBlocks, message.textContent, message.toolCalls);
		for (const seg of additionalSegments) {
			pushSegment(seg.thinkingBlocks, seg.textContent, seg.toolCalls);
		}

		return items;
	});
</script>

<div class="max-w-[95%]">
	<div
		class="border-l-accent-400/30 bg-surface-900/70 rounded-xl rounded-bl-md border-l-2 px-4 py-3"
	>
		<div class="mb-2 flex items-center justify-between gap-4">
			<div class="flex items-center gap-2">
				<span class="text-accent-400 text-[10px] font-semibold tracking-wider uppercase"
					>Claude</span
				>
				{#if message.model}
					<span class="text-text-500 text-[9px]">{message.model}</span>
				{/if}
			</div>
			<span class="text-text-500 text-[10px]">{formatTime(message.timestamp)}</span>
		</div>

		{#each renderItems as item, i (i)}
			{#if item.kind === 'thinking'}
				<ThinkingBlock content={item.content} />
			{:else if item.kind === 'text'}
				<div class="prose-invert text-sm leading-relaxed {i > 0 ? 'mt-3' : ''}">
					<MarkdownContent content={item.content} />
				</div>
			{:else if item.kind === 'tools'}
				<div class="mt-3">
					<ToolCallGroup tools={item.tools} />
				</div>
			{/if}
		{/each}
	</div>
</div>
