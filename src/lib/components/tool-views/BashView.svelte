<script lang="ts">
	import type { ToolCall } from '$lib/types.js';

	let { tool, resultText }: { tool: ToolCall; resultText: string } = $props();

	let isError = $derived(tool.result?.isError ?? false);
	let dotColor = $derived.by(() => {
		if (isError) return 'bg-error-500';
		if (tool.result !== undefined) return 'bg-success-500';
		return 'bg-accent-400';
	});
</script>

{#if typeof tool.input.command === 'string'}
	<div class="overflow-hidden rounded-md">
		<!-- Terminal header bar -->
		<div class="bg-surface-800 flex items-center gap-2 px-3 py-1.5">
			<span class="inline-block h-1.5 w-1.5 rounded-full {dotColor}"></span>
			<span class="text-text-500 font-mono text-[10px]">terminal</span>
		</div>

		<!-- Command -->
		<pre
			class="bg-accent-500/8 border-accent-500/15 text-accent-200 max-h-32 overflow-auto border-b px-3 py-2 font-mono text-[11px] leading-relaxed font-bold break-words whitespace-pre-wrap"><span
				class="text-accent-400/60 select-none"
				>$ </span>{tool.input.command}</pre>
	</div>
{/if}
{#if tool.result !== undefined}
	<div class="relative">
		{#if isError}
			<span
				class="text-error-400 bg-error-500/15 absolute top-2 right-2 rounded-full px-2 py-0.5 font-mono text-[9px] font-medium"
				>exit 1</span
			>
		{/if}
		<pre
			class="bg-surface-950 max-h-96 overflow-auto rounded-md p-3 text-[11px] {isError
				? 'text-error-400'
				: 'text-text-300'} font-mono leading-relaxed break-words whitespace-pre-wrap">{resultText}</pre>
	</div>
{/if}
