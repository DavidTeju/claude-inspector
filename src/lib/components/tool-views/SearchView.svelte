<script lang="ts">
	import type { ToolCall } from '$lib/types.js';

	let { tool, resultText }: { tool: ToolCall; resultText: string } = $props();
</script>

<div class="flex items-center gap-2">
	{#if typeof tool.input.pattern === 'string'}
		<pre
			class="bg-accent-500/5 border-accent-500/20 text-accent-300 inline-block rounded border px-2 py-1 font-mono text-[11px] break-words whitespace-pre-wrap">{tool
				.input.pattern}</pre>
	{/if}
	{#if tool.input.path}
		<span class="text-text-500 font-mono text-[10px]">in {tool.input.path}</span>
	{/if}
</div>
{#if tool.result !== undefined}
	<pre
		class="bg-surface-950 text-text-300 max-h-96 overflow-auto rounded-md p-2 font-mono text-[11px] leading-relaxed break-words whitespace-pre-wrap">{resultText}</pre>
{/if}
