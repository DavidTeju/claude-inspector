<script lang="ts">
	import type { SearchResult } from '$lib/types.js';
	import { highlightTerms, formatDate } from '$lib/utils.js';
	import { resolve } from '$app/paths';

	let { result, query }: { result: SearchResult; query: string } = $props();
</script>

<a
	href={resolve(`/session/${result.projectId}/${result.sessionId}`)}
	class="border-border bg-card/50 hover:border-border hover:bg-card block rounded-lg border p-4 transition-all transition-shadow hover:shadow-md"
>
	<div class="mb-2 flex items-center gap-2">
		<span class="text-primary/60 text-[10px] tracking-wider uppercase">{result.projectName}</span>
		<span class="text-surface-800">|</span>
		<span class="text-muted-foreground text-[10px]">{formatDate(result.modified)}</span>
	</div>

	{#if result.sessionSummary}
		<h3 class="text-foreground mb-1 text-base font-semibold tracking-tight">
			{@html highlightTerms(result.sessionSummary, query)}
		</h3>
	{/if}

	{#if result.firstPrompt}
		<p class="text-muted-foreground mb-2 line-clamp-1 text-sm">
			{@html highlightTerms(result.firstPrompt, query)}
		</p>
	{/if}

	{#if result.snippets.length > 0}
		<div class="space-y-1">
			{#each result.snippets as snippet, i (i)}
				<p class="text-muted-foreground line-clamp-2 text-[11px] leading-relaxed">
					{@html highlightTerms(snippet, query)}
				</p>
			{/each}
		</div>
	{/if}
</a>
