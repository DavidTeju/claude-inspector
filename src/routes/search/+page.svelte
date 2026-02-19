<script lang="ts">
	import { resolve } from '$app/paths';

	let { data } = $props();

	let query = $derived((data.query as string) || '');
	let results = $derived(data.results);

	function highlightTerms(text: string, q: string): string {
		if (!q || !text) return text;
		const terms = q
			.toLowerCase()
			.split(/\s+/)
			.filter((t) => t.length > 1);
		let result = text;
		for (const term of terms) {
			const regex = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
			result = result.replace(
				regex,
				'<mark class="bg-accent-500/30 text-accent-300 rounded px-0.5">$1</mark>'
			);
		}
		return result;
	}

	function formatDate(iso: string): string {
		if (!iso) return '';
		const d = new Date(iso);
		return d.toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}
</script>

<svelte:head>
	<title>Search{query ? ` - ${query}` : ''} - Claude Inspector</title>
</svelte:head>

<div class="mx-auto max-w-3xl">
	<div class="mb-6">
		<h1 class="text-lg font-bold text-zinc-100">Search</h1>
	</div>

	<form method="GET" action={resolve('/search')} class="mb-6">
		<input
			name="q"
			type="text"
			value={query}
			placeholder="Search across all sessions..."
			class="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-sm text-zinc-200 placeholder-zinc-600 outline-none transition-colors focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600"
		/>
	</form>

	{#if query}
		<div class="mb-4 text-xs text-zinc-500">
			{results.length} result{results.length !== 1 ? 's' : ''} for "{query}"
		</div>
	{/if}

	<div class="space-y-3">
		{#each results as result (result.sessionId)}
			<a
				href={resolve(`/session/${result.projectId}/${result.sessionId}`)}
				class="block rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 transition-all hover:border-zinc-700 hover:bg-zinc-900"
			>
				<div class="flex items-center gap-2 mb-2">
					<span class="text-[10px] text-zinc-600 uppercase tracking-wider"
						>{result.projectName}</span
					>
					<span class="text-zinc-800">|</span>
					<span class="text-[10px] text-zinc-600">{formatDate(result.modified)}</span>
				</div>

				{#if result.sessionSummary}
					<h3 class="text-sm font-medium text-zinc-200 mb-1">
						{@html highlightTerms(result.sessionSummary, query)}
					</h3>
				{/if}

				<p class="text-xs text-zinc-500 mb-2 line-clamp-1">
					{@html highlightTerms(result.firstPrompt, query)}
				</p>

				{#if result.snippets.length > 0}
					<div class="space-y-1">
						{#each result.snippets as snippet, i (i)}
							<p class="text-[11px] text-zinc-500 leading-relaxed line-clamp-2">
								{@html highlightTerms(snippet, query)}
							</p>
						{/each}
					</div>
				{/if}
			</a>
		{/each}
	</div>

	{#if query && results.length === 0}
		<div class="py-12 text-center text-zinc-600">
			<p class="text-sm">No results found for "{query}"</p>
			<p class="mt-1 text-xs">Try different keywords or check spelling</p>
		</div>
	{/if}
</div>
