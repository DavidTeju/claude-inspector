<script lang="ts">
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Card, CardHeader, CardContent } from '$lib/components/ui/card/index.js';
	import type { SearchResult } from '$lib/types.js';
	import { highlightTerms, formatDate } from '$lib/utils.js';
	import { resolve } from '$app/paths';

	let { result, query }: { result: SearchResult; query: string } = $props();
</script>

<a
	href={resolve(`/session/${result.projectId}/${result.sessionId}`)}
	class="group block transition-all hover:-translate-y-0.5"
>
	<Card class="group-hover:ring-foreground/20 transition-shadow group-hover:shadow-md">
		<CardHeader class="pb-0">
			<div class="flex items-center gap-2">
				<Badge variant="outline" class="text-[10px] tracking-wider uppercase"
					>{result.projectName}</Badge
				>
				<span class="text-muted-foreground text-[10px]">{formatDate(result.modified)}</span>
			</div>
		</CardHeader>
		<CardContent class="space-y-1.5">
			{#if result.sessionSummary}
				<h3 class="text-foreground text-base font-semibold tracking-tight">
					{@html highlightTerms(result.sessionSummary, query)}
				</h3>
			{/if}

			{#if result.firstPrompt}
				<p class="text-muted-foreground line-clamp-1 text-sm">
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
		</CardContent>
	</Card>
</a>
