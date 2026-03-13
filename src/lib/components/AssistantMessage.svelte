<script lang="ts">
	import ToolUseBlock from './ToolUseBlock.svelte';
	import ThinkingBlock from './ThinkingBlock.svelte';
	import MarkdownContent from './MarkdownContent.svelte';
	import { formatTime } from '$lib/utils.js';

	let {
		message
	}: {
		message: {
			uuid: string;
			timestamp: string;
			textContent: string;
			toolCalls: Array<{
				id: string;
				name: string;
				input: Record<string, unknown>;
				result?: string | Array<{ type: string; text?: string }>;
				isError?: boolean;
			}>;
			thinkingBlocks: string[];
			model?: string;
		};
	} = $props();
</script>

<div class="max-w-[95%]">
	<div class="rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3">
		<div class="mb-2 flex items-center justify-between gap-4">
			<div class="flex items-center gap-2">
				<span class="text-[10px] font-semibold uppercase tracking-wider text-accent-400/70"
					>Claude</span
				>
				{#if message.model}
					<span class="text-[9px] text-zinc-600">{message.model}</span>
				{/if}
			</div>
			<span class="text-[10px] text-zinc-600">{formatTime(message.timestamp)}</span>
		</div>

		{#each message.thinkingBlocks as thinking, i (i)}
			<ThinkingBlock content={thinking} />
		{/each}

		{#if message.textContent.trim()}
			<div class="prose-invert text-sm leading-relaxed">
				<MarkdownContent content={message.textContent} />
			</div>
		{/if}

		{#if message.toolCalls.length > 0}
			<div class="mt-3 space-y-2">
				{#each message.toolCalls as tool (tool.id)}
					<ToolUseBlock {tool} />
				{/each}
			</div>
		{/if}
	</div>
</div>
