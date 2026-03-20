<script lang="ts">
	import { searchOverlay } from '$lib/stores/search-overlay.svelte.js';
	import type { SearchResult } from '$lib/types.js';
	import { highlightTerms, formatDate } from '$lib/utils.js';
	import { resolve } from '$app/paths';

	let { result, query }: { result: SearchResult; query: string } = $props();
</script>

<a
	href={resolve(`/session/${result.projectId}/${result.sessionId}`)}
	onclick={() => searchOverlay.hide()}
	class="card-hover border-surface-800 bg-surface-900/50 hover:border-surface-700 hover:bg-surface-900 block rounded-lg border p-4 transition-all"
>
	<div class="mb-2 flex items-center gap-2">
		<span class="text-accent-400/60 text-[10px] tracking-wider uppercase">{result.projectName}</span
		>
		<span class="text-surface-800">|</span>
		<span class="text-text-500 text-[10px]">{formatDate(result.modified)}</span>
	</div>

	{#if result.sessionSummary}
		<h3 class="text-text-100 mb-1 text-base font-semibold tracking-tight">
			{@html highlightTerms(result.sessionSummary, query)}
		</h3>
	{/if}

	{#if result.firstPrompt}
		<p class="text-text-500 mb-2 line-clamp-1 text-sm">
			{@html highlightTerms(result.firstPrompt, query)}
		</p>
	{/if}

	{#if result.snippets.length > 0}
		<div class="space-y-1">
			{#each result.snippets as snippet, i (i)}
				<p class="text-text-500 line-clamp-2 text-[11px] leading-relaxed">
					{@html highlightTerms(snippet, query)}
				</p>
			{/each}
		</div>
	{/if}
</a>
