<script lang="ts">
	import type { ToolCall } from '$lib/types.js';

	let { tool, resultText }: { tool: ToolCall; resultText: string } = $props();
</script>

{#if typeof tool.input.content === 'string'}
	<pre
		class="bg-surface-950 text-text-300 max-h-96 overflow-auto rounded-md p-2 font-mono text-[11px] leading-relaxed break-words whitespace-pre-wrap">{tool
			.input.content}</pre>
{/if}
{#if tool.result?.isError}
	<pre class="text-error-400 mt-1 text-[11px] break-words whitespace-pre-wrap">{resultText}</pre>
{/if}
