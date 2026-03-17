<script lang="ts">
	import ProjectCard from '$lib/components/ProjectCard.svelte';
	import SearchInput from '$lib/components/SearchInput.svelte';
	import SearchResultCard from '$lib/components/SearchResultCard.svelte';
	import { STAGGER_BASE_MS, STAGGER_DELAY_MS } from '$lib/constants.js';
	import type { Project, SearchResult } from '$lib/types.js';
	import { getErrorMessage, pluralize } from '$lib/utils.js';

	const EVENT_PREFIX = 'event: ';
	const DATA_PREFIX = 'data: ';
	const RESULTS_PER_PAGE = 20;

	type SearchSortMode = 'relevance' | 'newest' | 'oldest';

	interface SSEEvent {
		type: string;
		data: string;
	}

	const SEARCH_SORT_OPTIONS: Array<{ value: SearchSortMode; label: string }> = [
		{ value: 'relevance', label: 'Relevance' },
		{ value: 'newest', label: 'Newest' },
		{ value: 'oldest', label: 'Oldest' }
	];

	function parseSSEEvent(raw: string): SSEEvent | null {
		if (!raw.trim()) return null;

		const lines = raw.split('\n');
		let eventType = '';
		let eventData = '';

		for (const line of lines) {
			if (line.startsWith(EVENT_PREFIX)) {
				eventType = line.slice(EVENT_PREFIX.length);
			} else if (line.startsWith(DATA_PREFIX)) {
				eventData = line.slice(DATA_PREFIX.length);
			}
		}

		if (!eventType || !eventData) return null;
		return { type: eventType, data: eventData };
	}

	async function* parseSSEStream(body: ReadableStream<Uint8Array>): AsyncGenerator<SSEEvent> {
		const reader = body.getReader();
		const decoder = new TextDecoder();
		let buffer = '';

		while (true) {
			const { done, value } = await reader.read();
			if (done) break;

			buffer += decoder.decode(value, { stream: true });

			const chunks = buffer.split('\n\n');
			buffer = chunks.pop() || '';

			for (const chunk of chunks) {
				const event = parseSSEEvent(chunk);
				if (event) yield event;
			}
		}
	}

	let { data } = $props();

	let projects: Project[] = $derived(data.projects);

	let searchQuery = $state('');
	let results: SearchResult[] = $state([]);
	let searchSortMode = $state<SearchSortMode>('relevance');
	let isSearching = $state(false);
	let searchError = $state<string | null>(null);
	let abortController: AbortController | null = $state(null);
	let showResults = $derived(searchQuery.length >= 2);
	let displayCount = $state(RESULTS_PER_PAGE);
	let sortedResults = $derived.by(() => {
		return [...results].sort((a, b) => {
			const modifiedDelta = new Date(b.modified).getTime() - new Date(a.modified).getTime();

			if (searchSortMode === 'newest') return modifiedDelta;
			if (searchSortMode === 'oldest') return -modifiedDelta;
			if (b.relevance !== a.relevance) return b.relevance - a.relevance;
			return modifiedDelta;
		});
	});
	let visibleResults = $derived(sortedResults.slice(0, displayCount));
	let hasMore = $derived(sortedResults.length > displayCount);

	function cancelSearch() {
		if (abortController) {
			abortController.abort();
			abortController = null;
		}
		results = [];
		isSearching = false;
		searchError = null;
	}

	async function executeSearch(query: string) {
		if (!query || query.length < 2) {
			cancelSearch();
			return;
		}

		if (abortController) {
			abortController.abort();
		}

		const controller = new AbortController();
		abortController = controller;
		results = [];
		displayCount = RESULTS_PER_PAGE;
		isSearching = true;
		searchError = null;

		try {
			const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
				signal: controller.signal
			});

			if (!response.ok || !response.body) {
				isSearching = false;
				searchError = `Search failed (${response.status})`;
				return;
			}

			for await (const event of parseSSEStream(response.body)) {
				try {
					const parsed = JSON.parse(event.data);

					if (event.type === 'result') {
						results.push(parsed as SearchResult);
					} else if (event.type === 'done') {
						isSearching = false;
					} else if (event.type === 'error') {
						isSearching = false;
						searchError = parsed.message ?? 'Search encountered an error';
					}
				} catch {
					// Skip malformed event data
				}
			}
		} catch (err: unknown) {
			if (err instanceof Error && err.name === 'AbortError') {
				return;
			}
			console.error('[search] Search failed:', err);
			searchError = `Search failed: ${getErrorMessage(err)}`;
			isSearching = false;
		}
	}
</script>

<svelte:head>
	<title>Claude Inspector</title>
</svelte:head>

<div>
	<div class="mb-8">
		<h1 class="page-title">Search sessions</h1>
		<p class="page-subtitle">
			Inspect transcripts, jump between projects, and find the exact Claude conversation you need.
		</p>
	</div>

	<SearchInput bind:query={searchQuery} onSearch={executeSearch} />

	{#if showResults}
		<!-- Search results -->
		<div>
			{#if searchError}
				<div class="bg-error-500/10 text-error-400 mb-4 rounded-md px-3 py-2 text-center text-xs">
					{searchError}
				</div>
			{/if}

			<div
				class="text-text-500 mb-4 flex flex-col gap-3 text-xs sm:flex-row sm:items-center sm:justify-between"
			>
				<div class="flex items-center gap-2">
					{#if isSearching}
						<svg class="text-accent-400 h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
							<circle
								class="opacity-25"
								cx="12"
								cy="12"
								r="10"
								stroke="currentColor"
								stroke-width="4"
							/>
							<path
								class="opacity-75"
								fill="currentColor"
								d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
							/>
						</svg>
						<span>Searching... {results.length} result{results.length !== 1 ? 's' : ''}</span>
					{:else}
						<span>{results.length} result{results.length !== 1 ? 's' : ''} for "{searchQuery}"</span
						>
					{/if}
				</div>

				<div class="flex items-center gap-1.5">
					<span class="text-text-500 mr-1 text-[11px] tracking-wide uppercase">Sort</span>
					{#each SEARCH_SORT_OPTIONS as option (option.value)}
						<button
							onclick={() => (searchSortMode = option.value)}
							class={`rounded-md border px-2.5 py-1 transition-colors ${
								searchSortMode === option.value
									? 'border-accent-500/50 bg-accent-500/10 text-accent-300'
									: 'border-surface-800 bg-surface-900/50 text-text-500 hover:border-surface-700 hover:text-text-100'
							}`}
						>
							{option.label}
						</button>
					{/each}
				</div>
			</div>

			{#if results.length > 0}
				<div class="space-y-3">
					{#each visibleResults as result, i (result.projectId + '/' + result.sessionId)}
						<div
							class="animate-fade-in-up"
							style="animation-delay: {Math.min(i, STAGGER_DELAY_MS) * STAGGER_BASE_MS}ms"
						>
							<SearchResultCard {result} query={searchQuery} />
						</div>
					{/each}
				</div>

				{#if hasMore}
					<button
						onclick={() => (displayCount += RESULTS_PER_PAGE)}
						class="border-surface-800 bg-surface-900/50 text-text-300 hover:border-surface-700 hover:text-text-100 mt-4 w-full rounded-lg border py-2.5 text-xs transition-colors"
					>
						Show more ({sortedResults.length - displayCount} remaining)
					</button>
				{/if}
			{:else if !isSearching}
				<div class="text-text-500 py-12 text-center">
					<p class="text-sm">No results found for "{searchQuery}"</p>
					<p class="mt-1 text-xs">Try different keywords or check spelling</p>
				</div>
			{/if}
		</div>
	{:else}
		<!-- Project grid -->
		<div>
			<div class="mb-4 flex items-baseline justify-between">
				<h2 class="section-title">Projects</h2>
				<span class="text-text-500 text-sm">{pluralize(projects.length, 'project')}</span>
			</div>

			<div class="grid grid-cols-1 items-start gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
				{#each projects as project, i (project.id)}
					<div
						class="animate-fade-in-up"
						style="animation-delay: {Math.min(i, STAGGER_DELAY_MS) * STAGGER_BASE_MS}ms"
					>
						<ProjectCard {project} />
					</div>
				{/each}
			</div>
		</div>
	{/if}
</div>
