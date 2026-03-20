<script lang="ts">
	import { Search } from '@lucide/svelte';
	import type { ToolCall } from '$lib/types.js';

	let { tool, resultText }: { tool: ToolCall; resultText: string } = $props();

	let resultLineCount = $derived(
		tool.result !== undefined ? resultText.split('\n').filter((l) => l.trim()).length : 0
	);
</script>

<div class="flex flex-wrap items-center gap-2">
	{#if typeof tool.input.pattern === 'string'}
		<div
			class="bg-accent-500/5 border-accent-500/20 flex items-center gap-1.5 rounded border px-2 py-1"
		>
			<Search class="text-accent-400/60 h-3 w-3 flex-shrink-0" />
			<span class="text-accent-300 font-mono text-[11px] break-words whitespace-pre-wrap"
				>{tool.input.pattern}</span
			>
		</div>
	{/if}
	{#if tool.input.path}
		<span class="bg-surface-800 text-text-500 rounded px-1.5 py-0.5 font-mono text-[10px]"
			>in {tool.input.path}</span
		>
	{/if}
	{#if resultLineCount > 0}
		<span class="text-text-500 text-[10px]">{resultLineCount} results</span>
	{/if}
</div>
{#if tool.result !== undefined}
	<pre
		class="bg-surface-950 text-text-300 max-h-96 overflow-auto rounded-md p-2 font-mono text-[11px] leading-relaxed break-words whitespace-pre-wrap">{resultText}</pre>
{/if}
