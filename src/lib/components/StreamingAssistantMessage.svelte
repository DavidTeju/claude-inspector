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
		if (!text?.trim()) return { complete: '', trailing: '' };
		const lastNewline = text.lastIndexOf('\n');
		if (lastNewline === -1) return { complete: '', trailing: text };
		return {
			complete: text.slice(0, lastNewline),
			trailing: text.slice(lastNewline + 1)
		};
	});
</script>

<div class="chat chat-start">
	<div class="chat-header text-xs">
		Claude
		{#if model}<span class="text-[9px] opacity-50">{model}</span>{/if}
		<span class="bg-primary inline-block h-1.5 w-1.5 animate-pulse rounded-full"></span>
	</div>
	<div class="chat-bubble chat-bubble-primary bg-primary/10 text-base-content max-w-[95%]">
		<div class="space-y-3">
			<!-- Thinking -->
			{#if thinking}
				<ThinkingBlock content={thinking} />
			{/if}

			<!-- Text content: complete paragraphs + trailing cursor are one visual block -->
			{#if splitContent.complete || splitContent.trailing || text?.trim()}
				<div>
					{#if splitContent.complete}
						<div class="prose-invert text-sm leading-relaxed">
							<MarkdownContent content={splitContent.complete} />
						</div>
					{/if}
					{#if splitContent.trailing || (!splitContent.complete && text?.trim())}
						<div
							class="text-base-content/70 text-sm leading-relaxed {splitContent.complete
								? 'mt-1'
								: ''}"
						>
							{splitContent.trailing}<span class="animate-blink text-primary">&#x258A;</span>
						</div>
					{/if}
				</div>
			{/if}

			<!-- In-progress tool calls -->
			{#if toolCalls.length > 0}
				<ToolCallGroup tools={toolCalls} />
			{/if}
		</div>
	</div>
</div>
