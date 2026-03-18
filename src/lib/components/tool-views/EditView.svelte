<script lang="ts">
	import { diffLines } from 'diff';
	import type { ToolCall } from '$lib/types.js';

	let { tool, resultText }: { tool: ToolCall; resultText: string } = $props();

	let editDiff = $derived.by(() => {
		const oldStr = tool.input.old_string;
		const newStr = tool.input.new_string;
		if (typeof oldStr !== 'string' || typeof newStr !== 'string') return [];
		return diffLines(oldStr, newStr);
	});
</script>

{#if editDiff.length > 0}
	<div class="bg-surface-950 max-h-96 overflow-auto rounded-md font-mono text-[11px]">
		{#each editDiff as change, ci (ci)}
			{@const lines = change.value.replace(/\n$/, '').split('\n')}
			{#each lines as line, li (li)}
				{#if change.removed}
					<div class="bg-error-500/10 text-error-400 flex">
						<span class="text-error-400/50 w-6 flex-shrink-0 pr-1 text-right select-none"
							>&minus;</span
						>
						<span class="pl-1 break-words whitespace-pre-wrap">{line}</span>
					</div>
				{:else if change.added}
					<div class="bg-success-500/10 text-success-500 flex">
						<span class="text-success-500/50 w-6 flex-shrink-0 pr-1 text-right select-none">+</span>
						<span class="pl-1 break-words whitespace-pre-wrap">{line}</span>
					</div>
				{:else}
					<div class="text-text-500 flex">
						<span class="text-text-700 w-6 flex-shrink-0 pr-1 text-right select-none">&nbsp;</span>
						<span class="pl-1 break-words whitespace-pre-wrap">{line}</span>
					</div>
				{/if}
			{/each}
		{/each}
	</div>
{:else}
	<pre
		class="bg-surface-950 text-text-300 max-h-64 overflow-auto rounded-md p-2 font-mono text-[11px] leading-relaxed break-words whitespace-pre-wrap">{JSON.stringify(
			tool.input,
			null,
			2
		)}</pre>
{/if}

{#if tool.result?.isError}
	<pre class="text-error-400 mt-1 text-[11px] break-words whitespace-pre-wrap">{resultText}</pre>
{/if}
