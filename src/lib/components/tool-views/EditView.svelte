<script lang="ts">
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
	<div class="bg-muted flex items-center gap-2 rounded-t-md px-3 py-1.5">
		<svg
			class="text-muted-foreground h-3.5 w-3.5 flex-shrink-0"
			fill="none"
			viewBox="0 0 24 24"
			stroke="currentColor"
			stroke-width="1.5"
		>
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
			/>
		</svg>
		<span class="text-foreground/80 truncate font-mono text-[10px]">{filePath}</span>
		{#if tool.input.replace_all}
			<span
				class="bg-primary/10 text-primary ml-auto rounded px-1.5 py-0.5 text-[9px] font-medium"
				>replace_all</span
			>
		{/if}
	</div>
{/if}

{#if editDiff.length > 0}
	<div
		class="bg-background max-h-96 overflow-auto font-mono text-[11px] {filePath
			? 'rounded-b-md'
			: 'rounded-md'}"
	>
		{#each editDiff as change, ci (ci)}
			{@const lines = change.value.replace(/\n$/, '').split('\n')}
			{#each lines as line, li (li)}
				{#if change.removed}
					<div class="bg-destructive/10 text-destructive flex">
						<span
							class="border-destructive/20 w-10 flex-shrink-0 border-r pr-1 text-right select-none"
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
					<div class="text-muted-foreground flex">
						<span
							class="border-border text-muted-foreground/60 w-10 flex-shrink-0 border-r pr-1 text-right select-none"
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
		class="bg-background text-foreground/80 max-h-64 overflow-auto rounded-md p-2 font-mono text-[11px] leading-relaxed break-words whitespace-pre-wrap">{JSON.stringify(
			tool.input,
			null,
			2
		)}</pre>
{/if}

{#if tool.result?.isError}
	<pre class="text-destructive mt-1 text-[11px] break-words whitespace-pre-wrap">{resultText}</pre>
{/if}
