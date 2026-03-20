<script lang="ts">
	import { FileText } from '@lucide/svelte';
	import { diffLines } from 'diff';
	import type { ToolCall } from '$lib/types.js';

	let { tool, resultText }: { tool: ToolCall; resultText: string } = $props();

	let filePath = $derived(typeof tool.input.file_path === 'string' ? tool.input.file_path : '');

	let editDiff = $derived.by(() => {
		const oldStr = tool.input.old_string;
		const newStr = tool.input.new_string;
		if (typeof oldStr !== 'string' || typeof newStr !== 'string') return [];
		return diffLines(oldStr, newStr);
	});
</script>

{#if filePath}
	<div class="bg-surface-800 flex items-center gap-2 rounded-t-md px-3 py-1.5">
		<FileText class="text-text-500 h-3.5 w-3.5 flex-shrink-0" stroke-width="1.5" />
		<span class="text-text-300 truncate font-mono text-[10px]">{filePath}</span>
		{#if tool.input.replace_all}
			<span
				class="bg-accent-500/10 text-accent-300 ml-auto rounded px-1.5 py-0.5 text-[9px] font-medium"
				>replace_all</span
			>
		{/if}
	</div>
{/if}

{#if editDiff.length > 0}
	<div
		class="bg-surface-950 max-h-96 overflow-auto font-mono text-[11px] {filePath
			? 'rounded-b-md'
			: 'rounded-md'}"
	>
		{#each editDiff as change, ci (ci)}
			{@const lines = change.value.replace(/\n$/, '').split('\n')}
			{#each lines as line, li (li)}
				{#if change.removed}
					<div class="bg-error-500/10 text-error-400 flex">
						<span
							class="border-error-500/20 w-10 flex-shrink-0 border-r pr-1 text-right select-none"
							>&minus;</span
						>
						<span class="pl-2 break-words whitespace-pre-wrap">{line}</span>
					</div>
				{:else if change.added}
					<div class="bg-success-500/10 text-success-500 flex">
						<span
							class="border-success-500/20 w-10 flex-shrink-0 border-r pr-1 text-right select-none"
							>+</span
						>
						<span class="pl-2 break-words whitespace-pre-wrap">{line}</span>
					</div>
				{:else}
					<div class="text-text-500 flex">
						<span
							class="border-surface-800 text-text-700 w-10 flex-shrink-0 border-r pr-1 text-right select-none"
							>&nbsp;</span
						>
						<span class="pl-2 break-words whitespace-pre-wrap">{line}</span>
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
