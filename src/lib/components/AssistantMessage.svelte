<script lang="ts">
	import type { ToolCall, ThreadMessage, ContentSegment } from '$lib/types.js';
	import { formatTime } from '$lib/utils.js';
	import MarkdownContent from './MarkdownContent.svelte';
	import ThinkingBlock from './ThinkingBlock.svelte';
	import ToolCallGroup from './ToolCallGroup.svelte';

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

<div class="max-w-[95%] min-w-0">
	<div
		class="border-l-accent-400/30 bg-card/70 rounded-xl rounded-bl-md border-l-2 px-4 py-3"
	>
		<div class="mb-2 flex items-center justify-between gap-4">
			<div class="flex items-center gap-2">
				<span class="text-primary text-[10px] font-semibold tracking-wider uppercase"
					>Claude</span
				>
				{#if message.model}
					<span class="text-muted-foreground text-[9px]">{message.model}</span>
				{/if}
			</div>
			<span class="text-muted-foreground text-[10px]">{formatTime(message.timestamp)}</span>
		</div>

		<div class="space-y-3">
			{#each renderItems as item, i (i)}
				{#if item.kind === 'thinking'}
					<ThinkingBlock content={item.content} />
				{:else if item.kind === 'text'}
					<div class="prose-invert text-sm leading-relaxed">
						<MarkdownContent content={item.content} />
					</div>
				{:else if item.kind === 'tools'}
					<ToolCallGroup tools={item.tools} />
				{/if}
			{/each}
		</div>
	</div>
</div>
