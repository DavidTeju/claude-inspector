<script lang="ts">
	import { page } from '$app/state';
	import type { Project, SearchResult } from '$lib/types.js';
	import ProjectCard from '$lib/components/ProjectCard.svelte';
	import SearchResultCard from '$lib/components/SearchResultCard.svelte';

	let { data } = $props();

	let projects: Project[] = $derived(data.projects);

	let searchQuery = $state('');
	let results: SearchResult[] = $state([]);
	let isSearching = $state(false);
	let totalResults = $state(0);
	let abortController: AbortController | null = $state(null);
	let debounceTimer: ReturnType<typeof setTimeout> | null = null;
	let searchInput: HTMLInputElement;
	let showResults = $derived(searchQuery.length >= 2);
	const RESULTS_PER_PAGE = 20;
	let displayCount = $state(RESULTS_PER_PAGE);
	let visibleResults = $derived(results.slice(0, displayCount));
	let hasMore = $derived(results.length > displayCount);

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
		totalResults = 0;
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
		totalResults = 0;
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
							results = [...results, parsed as SearchResult];
						} else if (eventType === 'done') {
							totalResults = parsed.totalSessions;
							// Sort by relevance (terms in prompt/summary first), then by date
							results = [...results].sort((a, b) => {
								const ra = a.relevance ?? 0;
								const rb = b.relevance ?? 0;
								if (rb !== ra) return rb - ra;
								return new Date(b.modified).getTime() - new Date(a.modified).getTime();
							});
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
				class="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-600"
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
				class="w-full rounded-lg border border-zinc-800 bg-zinc-900 py-3 pl-12 pr-10 text-sm text-zinc-200 placeholder-zinc-600 outline-none transition-colors focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600"
			/>
			{#if searchQuery}
				<button
					onclick={clearSearch}
					class="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400"
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
			<div class="mb-4 flex items-center gap-2 text-xs text-zinc-500">
				{#if isSearching}
					<svg class="h-3 w-3 animate-spin text-accent-400" viewBox="0 0 24 24" fill="none">
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
					<span>{results.length} result{results.length !== 1 ? 's' : ''} for "{searchQuery}"</span>
				{/if}
			</div>

			{#if results.length > 0}
				<div class="space-y-3">
					{#each visibleResults as result (result.projectId + '/' + result.sessionId)}
						<SearchResultCard {result} query={searchQuery} />
					{/each}
				</div>

				{#if hasMore}
					<button
						onclick={() => (displayCount += RESULTS_PER_PAGE)}
						class="mt-4 w-full rounded-lg border border-zinc-800 bg-zinc-900/50 py-2.5 text-xs text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-300"
					>
						Show more ({results.length - displayCount} remaining)
					</button>
				{/if}
			{:else if !isSearching}
				<div class="py-12 text-center text-zinc-600">
					<p class="text-sm">No results found for "{searchQuery}"</p>
					<p class="mt-1 text-xs">Try different keywords or check spelling</p>
				</div>
			{/if}
		</div>
	{:else}
		<!-- Project grid -->
		<div>
			<div class="mb-4 flex items-baseline justify-between">
				<h2 class="text-lg font-bold text-zinc-100">Projects</h2>
				<span class="text-xs text-zinc-500">{projects.length} projects</span>
			</div>

			<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
				{#each projects as project (project.id)}
					<ProjectCard {project} />
				{/each}
			</div>
		</div>
	{/if}
</div>
