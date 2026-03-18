<script lang="ts">
	import type { ToolCall } from '$lib/types.js';

	let { tool, resultText }: { tool: ToolCall; resultText: string } = $props();
</script>

<div>
	<div class="text-text-500 mb-1 text-[10px] font-semibold tracking-wider uppercase">Input</div>
	<pre
		class="bg-surface-950 text-text-300 max-h-64 overflow-auto rounded-md p-2 font-mono text-[11px] leading-relaxed break-words whitespace-pre-wrap">{JSON.stringify(
			tool.input,
			null,
			2
		)}</pre>
</div>

{#if tool.result !== undefined}
	<div>
		<div
			class="mb-1 text-[10px] font-semibold tracking-wider uppercase {tool.result?.isError
				? 'text-error-500'
				: 'text-text-500'}"
		>
			{tool.result?.isError ? 'Error' : 'Result'}
		</div>
		<pre
			class="bg-surface-950 max-h-96 overflow-auto rounded-md p-2 text-[11px] {tool.result?.isError
				? 'text-error-400'
				: 'text-text-300'} font-mono leading-relaxed break-words whitespace-pre-wrap">{resultText}</pre>
	</div>
{/if}
