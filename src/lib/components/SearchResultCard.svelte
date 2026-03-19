<script lang="ts">
	import type { SearchResult } from '$lib/types.js';
	import { highlightTerms, formatDate } from '$lib/utils.js';
	import { resolve } from '$app/paths';

	let { result, query }: { result: SearchResult; query: string } = $props();
</script>

<a
	href={resolve(`/session/${result.projectId}/${result.sessionId}`)}
	class="card bg-base-100 border-l-primary/30 hover:border-l-primary block border-l-4 shadow-sm transition-all hover:shadow-md"
>
	<div class="card-body p-4">
		<div class="mb-2 flex items-center gap-2">
			<span class="badge badge-primary badge-outline badge-xs uppercase">{result.projectName}</span>
			<span class="text-base-content/50 text-[10px]">{formatDate(result.modified)}</span>
		</div>

		{#if result.sessionSummary}
			<h3 class="card-title text-base-content text-base">
				{@html highlightTerms(result.sessionSummary, query)}
			</h3>
		{/if}

		{#if result.firstPrompt}
			<p class="text-base-content/50 line-clamp-1 text-sm">
				{@html highlightTerms(result.firstPrompt, query)}
			</p>
		{/if}

		{#if result.snippets.length > 0}
			<div class="space-y-1">
				{#each result.snippets as snippet, i (i)}
					<p class="text-base-content/50 line-clamp-2 text-[11px] leading-relaxed">
						{@html highlightTerms(snippet, query)}
					</p>
				{/each}
			</div>
		{/if}
	</div>
</a>
