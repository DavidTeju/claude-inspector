<script lang="ts">
	import type { ToolCall } from '$lib/types.js';

	let { tool, resultText }: { tool: ToolCall; resultText: string } = $props();

	let isError = $derived(tool.result?.isError ?? false);
	let dotColor = $derived.by(() => {
		if (isError) return 'bg-error';
		if (tool.result !== undefined) return 'bg-success';
		return 'bg-primary';
	});
</script>

{#if typeof tool.input.command === 'string'}
	<div class="overflow-hidden rounded-md">
		<!-- Terminal header bar -->
		<div class="bg-base-300 flex items-center gap-2 px-3 py-1.5">
			<span class="inline-block h-1.5 w-1.5 rounded-full {dotColor}"></span>
			<span class="text-base-content/50 font-mono text-[10px]">terminal</span>
		</div>

		<!-- Command -->
		<pre
			class="bg-primary/5 border-primary/15 text-primary max-h-32 overflow-auto border-b px-3 py-2 font-mono text-[11px] leading-relaxed font-bold break-words whitespace-pre-wrap"><span
				class="text-primary/60 select-none"
				>$ </span>{tool.input.command}</pre>
	</div>
{/if}
{#if tool.result !== undefined}
	<div class="relative">
		{#if isError}
			<span class="badge badge-error badge-xs absolute top-2 right-2">exit 1</span>
		{/if}
		<pre
			class="bg-base-100 max-h-96 overflow-auto rounded-md p-3 text-[11px] {isError
				? 'text-error'
				: 'text-base-content/70'} font-mono leading-relaxed break-words whitespace-pre-wrap">{resultText}</pre>
	</div>
{/if}
