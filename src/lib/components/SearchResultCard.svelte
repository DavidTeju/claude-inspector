<script lang="ts">
	import { resolve } from '$app/paths';
	import type { SearchResult } from '$lib/types.js';
	import { highlightTerms, formatDate } from '$lib/utils.js';

	let { result, query }: { result: SearchResult; query: string } = $props();
</script>

<a
	href={resolve(`/session/${result.projectId}/${result.sessionId}`)}
	class="block rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 transition-all hover:border-zinc-700 hover:bg-zinc-900"
>
	<div class="mb-2 flex items-center gap-2">
		<span class="text-[10px] tracking-wider text-zinc-600 uppercase">{result.projectName}</span>
		<span class="text-zinc-800">|</span>
		<span class="text-[10px] text-zinc-600">{formatDate(result.modified)}</span>
	</div>

	{#if result.sessionSummary}
		<h3 class="mb-1 text-sm font-medium text-zinc-200">
			{@html highlightTerms(result.sessionSummary, query)}
		</h3>
	{/if}

	{#if result.firstPrompt}
		<p class="mb-2 line-clamp-1 text-xs text-zinc-500">
			{@html highlightTerms(result.firstPrompt, query)}
		</p>
	{/if}

	{#if result.snippets.length > 0}
		<div class="space-y-1">
			{#each result.snippets as snippet, i (i)}
				<p class="line-clamp-2 text-[11px] leading-relaxed text-zinc-500">
					{@html highlightTerms(snippet, query)}
				</p>
			{/each}
		</div>
	{/if}
</a>
