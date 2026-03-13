<script lang="ts">
	import { page } from '$app/state';
	import type { Project, SearchResult } from '$lib/types.js';
	import ProjectCard from '$lib/components/ProjectCard.svelte';
	import SearchResultCard from '$lib/components/SearchResultCard.svelte';

	type SearchSortMode = 'relevance' | 'newest' | 'oldest';

	const SEARCH_SORT_OPTIONS: Array<{ value: SearchSortMode; label: string }> = [
		{ value: 'relevance', label: 'Relevance' },
		{ value: 'newest', label: 'Newest' },
		{ value: 'oldest', label: 'Oldest' }
	];

	let { data } = $props();

	let projects: Project[] = $derived(data.projects);

	let searchQuery = $state('');
	let results: SearchResult[] = $state([]);
	let searchSortMode = $state<SearchSortMode>('relevance');
	let isSearching = $state(false);
	let abortController: AbortController | null = $state(null);
	let debounceTimer: ReturnType<typeof setTimeout> | null = null;
	let searchInput: HTMLInputElement;
	let showResults = $derived(searchQuery.length >= 2);
	const RESULTS_PER_PAGE = 20;
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

	// Auto-focus the search input on mount, and pick up ?q= from URL
	$effect(() => {
		if (searchInput) {
			searchInput.focus();
		}
		const urlQuery = page.url?.searchParams.get('q');
		if (urlQuery) {
			searchQuery = urlQuery;
			executeSearch(urlQuery);
		}
	});

	function handleInput() {
		if (debounceTimer) clearTimeout(debounceTimer);

		if (searchQuery.length < 2) {
			cancelSearch();
			return;
		}

		debounceTimer = setTimeout(() => {
			executeSearch(searchQuery);
		}, 300);
	}

	function cancelSearch() {
		if (abortController) {
			abortController.abort();
			abortController = null;
		}
		results = [];
		isSearching = false;
	}

	function clearSearch() {
		searchQuery = '';
		cancelSearch();
		searchInput?.focus();
	}

	async function executeSearch(query: string) {
		// Abort any in-flight request
		if (abortController) {
			abortController.abort();
		}

		const controller = new AbortController();
		abortController = controller;
		results = [];
		displayCount = RESULTS_PER_PAGE;
		isSearching = true;

		try {
			const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
				signal: controller.signal
			});

			if (!response.ok || !response.body) {
				isSearching = false;
				return;
			}

			const reader = response.body.getReader();
			const decoder = new TextDecoder();
			let buffer = '';

			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				buffer += decoder.decode(value, { stream: true });

				// Parse SSE events from buffer
				const events = buffer.split('\n\n');
				buffer = events.pop() || ''; // keep incomplete event in buffer

				for (const event of events) {
					if (!event.trim()) continue;

					const lines = event.split('\n');
					let eventType = '';
					let eventData = '';

					for (const line of lines) {
						if (line.startsWith('event: ')) {
							eventType = line.slice(7);
						} else if (line.startsWith('data: ')) {
							eventData = line.slice(6);
						}
					}

					if (!eventType || !eventData) continue;

					try {
						const parsed = JSON.parse(eventData);

						if (eventType === 'result') {
							results.push(parsed as SearchResult);
						} else if (eventType === 'done') {
							isSearching = false;
						} else if (eventType === 'error') {
							isSearching = false;
						}
					} catch {
						// Skip malformed event data
					}
				}
			}
		} catch (err: unknown) {
			if (err instanceof Error && err.name === 'AbortError') {
				// Expected — new search started or component unmounted
				return;
			}
			isSearching = false;
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			clearSearch();
		}
	}
</script>

<svelte:head>
	<title>Claude Inspector</title>
</svelte:head>

<div>
	<!-- Spotlight search input -->
	<div class="mb-6">
		<div class="relative">
			<svg
				class="text-text-500 absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
				stroke-width="2"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
				/>
			</svg>
			<input
				bind:this={searchInput}
				bind:value={searchQuery}
				oninput={handleInput}
				onkeydown={handleKeydown}
				type="text"
				placeholder="Search sessions..."
				class="input-glow border-surface-800 bg-surface-900 text-text-100 placeholder-text-500 focus:border-accent-500/50 w-full rounded-xl border py-3 pr-10 pl-12 text-sm transition-colors outline-none"
			/>
			{#if searchQuery}
				<button
					onclick={clearSearch}
					class="text-text-500 hover:text-text-300 absolute top-1/2 right-3 -translate-y-1/2"
					aria-label="Clear search"
				>
					<svg
						class="h-4 w-4"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="2"
					>
						<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			{/if}
		</div>
	</div>

	{#if showResults}
		<!-- Search results -->
		<div>
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
						<div class="animate-fade-in-up" style="animation-delay: {Math.min(i, 10) * 40}ms">
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
				<h2 class="text-text-100 text-lg font-bold">Projects</h2>
				<span class="text-text-500 text-xs">{projects.length} projects</span>
			</div>

			<div class="grid grid-cols-1 items-start gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
				{#each projects as project, i (project.id)}
					<div class="animate-fade-in-up" style="animation-delay: {Math.min(i, 10) * 40}ms">
						<ProjectCard {project} />
					</div>
				{/each}
			</div>
		</div>
	{/if}
</div>
