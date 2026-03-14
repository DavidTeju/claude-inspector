<script lang="ts">
	import type { ToolCall } from '$lib/types.js';
	import MarkdownContent from './MarkdownContent.svelte';
	import ThinkingBlock from './ThinkingBlock.svelte';
	import ToolCallGroup from './ToolCallGroup.svelte';

	let {
		text = '',
		thinking = '',
		toolCalls = [],
		model
	}: {
		text?: string;
		thinking?: string;
		toolCalls?: ToolCall[];
		model?: string;
	} = $props();

	let splitContent = $derived.by(() => {
		if (!text) return { complete: '', trailing: '' };
		const lastNewline = text.lastIndexOf('\n');
		if (lastNewline === -1) return { complete: '', trailing: text };
		return {
			complete: text.slice(0, lastNewline),
			trailing: text.slice(lastNewline + 1)
		};
	});
</script>

<div class="max-w-[95%]">
	<div
		class="border-l-accent-400/30 bg-surface-900/70 rounded-xl rounded-bl-md border-l-2 px-4 py-3"
	>
		<!-- Header -->
		<div class="mb-2 flex items-center gap-2">
			<span class="text-accent-400 text-[10px] font-semibold tracking-wider uppercase">Claude</span>
			{#if model}
				<span class="text-text-500 text-[9px]">{model}</span>
			{/if}
			<span class="bg-accent-400 h-1.5 w-1.5 animate-pulse rounded-full"></span>
		</div>

		<!-- Thinking -->
		{#if thinking}
			<ThinkingBlock content={thinking} />
		{/if}

		<!-- Rendered complete paragraphs -->
		{#if splitContent.complete}
			<div class="prose-invert text-sm leading-relaxed">
				<MarkdownContent content={splitContent.complete} />
			</div>
		{/if}

		<!-- Trailing text with blinking cursor -->
		{#if splitContent.trailing || (!splitContent.complete && text)}
			<div class="text-text-300 text-sm leading-relaxed {splitContent.complete ? 'mt-1' : ''}">
				{splitContent.trailing}<span class="animate-blink text-accent-400">&#x258A;</span>
			</div>
		{/if}

		<!-- In-progress tool calls -->
		{#if toolCalls.length > 0}
			<div class="mt-3">
				<ToolCallGroup tools={toolCalls} />
			</div>
		{/if}
	</div>
</div>
