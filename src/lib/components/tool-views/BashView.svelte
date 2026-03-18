<script lang="ts">
	import type { ToolCall } from '$lib/types.js';

	let { tool, resultText }: { tool: ToolCall; resultText: string } = $props();
</script>

{#if typeof tool.input.command === 'string'}
	<pre
		class="bg-accent-500/5 border-accent-500/20 text-accent-300 max-h-32 overflow-auto rounded-md border p-2 font-mono text-[11px] leading-relaxed break-words whitespace-pre-wrap">{tool
			.input.command}</pre>
{/if}
{#if tool.result !== undefined}
	<pre
		class="bg-surface-950 max-h-96 overflow-auto rounded-md p-2 text-[11px] {tool.result?.isError
			? 'text-error-400'
			: 'text-text-300'} font-mono leading-relaxed break-words whitespace-pre-wrap">{resultText}</pre>
{/if}
