<script lang="ts">
	import { parseClientFilters, rebuildQuery, type ParsedFilter } from '$lib/utils.js';
	import FilterPill from './FilterPill.svelte';
	import FilterPopover from './FilterPopover.svelte';

	const SEARCH_DEBOUNCE_MS = 300;
	const MAX_SUGGESTIONS = 8;
	const BLUR_CLOSE_DELAY_MS = 150;
	const DROPDOWN_MIN_WIDTH = 180;

	let {
		query = $bindable(''),
		onSearch
	}: {
		query: string;
		onSearch: (query: string) => void;
	} = $props();

	const initialParsed = query ? parseClientFilters(query) : null;
	let activeFilters: ParsedFilter[] = $state(initialParsed?.filters ?? []);
	let inputText = $state(initialParsed?.freeText ?? '');
	let showPopover = $state(false);
	let showAutocomplete = $state(false);
	let autocompleteIndex = $state(0);
	let inputEl: HTMLInputElement | undefined = $state(undefined);
	let containerEl: HTMLElement | undefined = $state(undefined);
	let measureEl: HTMLElement | undefined = $state(undefined);
	let debounceTimer: ReturnType<typeof setTimeout> | null = null;
	let suggestions: FilterSuggestion[] = $state([]);
	let dynamicTools: string[] = $state([]);
	let dynamicBranches: string[] = $state([]);
	let dynamicFetched = $state(false);
	let cursorAtEnd = $state(true);
	let dropdownLeft = $state(0);

	interface FilterSuggestion {
		raw: string;
		label: string;
		description: string;
	}

	const STATIC_SUGGESTIONS: FilterSuggestion[] = [
		{ raw: 'is:error', label: 'is:error', description: 'Sessions with API errors' },
		{ raw: 'is:subagent', label: 'is:subagent', description: 'Subagent sessions' },
		{ raw: 'has:cost', label: 'has:cost', description: 'Sessions with token usage' },
		{ raw: 'mode:raw', label: 'mode:raw', description: 'Full-text search mode' }
	];

	const PREFIX_SUGGESTIONS: FilterSuggestion[] = [
		{ raw: 'tool:', label: 'tool:', description: 'Filter by tool name' },
		{ raw: 'branch:', label: 'branch:', description: 'Filter by git branch' }
	];

	const ALL_SUGGESTIONS = [...STATIC_SUGGESTIONS, ...PREFIX_SUGGESTIONS];

	function filtersMatch(a: ParsedFilter, b: ParsedFilter): boolean {
		return a.prefix === b.prefix && a.value.toLowerCase() === b.value.toLowerCase();
	}

	function addFilterIfNew(filter: ParsedFilter) {
		if (!activeFilters.some((f) => filtersMatch(f, filter))) {
			activeFilters.push(filter);
		}
	}

	let ghostText = $derived.by(() => {
		if (!cursorAtEnd || !inputText) return '';
		const words = inputText.split(/\s+/);
		const currentWord = words[words.length - 1]?.toLowerCase() || '';
		if (!currentWord || currentWord.includes(':')) return '';

		for (const s of ALL_SUGGESTIONS) {
			if (s.raw.startsWith(currentWord) && s.raw !== currentWord) {
				return s.raw.slice(currentWord.length);
			}
		}
		return '';
	});

	let measureText = $derived.by(() => {
		const lastSpaceIdx = inputText.lastIndexOf(' ');
		return lastSpaceIdx >= 0 ? inputText.slice(0, lastSpaceIdx + 1) : '';
	});

	$effect(() => {
		inputEl?.focus();
	});

	// Must use $effect (not $derived) — getBoundingClientRect() reads DOM geometry
	// which is only current after Svelte's DOM flush. $derived runs before the flush,
	// so it would always read stale dimensions from the previous render.
	$effect(() => {
		void inputText;
		if (showAutocomplete && measureEl && containerEl) {
			const containerRect = containerEl.getBoundingClientRect();
			const measureRect = measureEl.getBoundingClientRect();
			const left = measureRect.right - containerRect.left;
			dropdownLeft = Math.max(0, Math.min(left, containerRect.width - DROPDOWN_MIN_WIDTH));
		}
	});

	function updateCursorAtEnd() {
		cursorAtEnd = !inputEl || inputEl.selectionStart === inputEl.value.length;
	}

	function emitQuery() {
		const rebuilt = rebuildQuery(activeFilters, inputText);
		query = rebuilt;

		if (debounceTimer) clearTimeout(debounceTimer);

		if (rebuilt.length < 2) {
			onSearch('');
			return;
		}

		debounceTimer = setTimeout(() => {
			onSearch(rebuilt);
		}, SEARCH_DEBOUNCE_MS);
	}

	function promoteFilters() {
		// Only promote completed tokens (those followed by a space).
		// The trailing word is still being typed, so exclude it.
		const trailingSpaceMatch = inputText.match(/^(.*\s)(\S*)$/);
		if (!trailingSpaceMatch) return;

		const completedPart = trailingSpaceMatch[1];
		const trailingWord = trailingSpaceMatch[2];
		const parsed = parseClientFilters(completedPart);

		if (parsed.filters.length > 0) {
			for (const filter of parsed.filters) {
				addFilterIfNew(filter);
			}
			const remaining = [parsed.freeText, trailingWord].filter(Boolean).join(' ');
			inputText = remaining;
		}
	}

	function handleInput() {
		updateCursorAtEnd();
		updateAutocomplete();
		promoteFilters();
		emitQuery();
	}

	function acceptGhostText() {
		inputText = inputText + ghostText;
		cursorAtEnd = true;

		const words = inputText.split(/\s+/);
		const lastWord = words[words.length - 1];

		// Complete filters (e.g. "is:error") get promoted to pills;
		// prefix-only (e.g. "tool:") stays as text so the value dropdown appears
		if (lastWord && !lastWord.endsWith(':')) {
			const parsed = parseClientFilters(lastWord);
			if (parsed.filters.length > 0) {
				for (const filter of parsed.filters) {
					addFilterIfNew(filter);
				}
				words.pop();
				inputText = words.length > 0 ? words.join(' ') + ' ' : '';
			}
		}

		updateAutocomplete();
		emitQuery();
	}

	function handleAutocompleteKeydown(event: KeyboardEvent): boolean {
		if (!showAutocomplete || suggestions.length === 0) return false;

		switch (event.key) {
			case 'ArrowDown':
				event.preventDefault();
				autocompleteIndex = (autocompleteIndex + 1) % suggestions.length;
				return true;
			case 'ArrowUp':
				event.preventDefault();
				autocompleteIndex = (autocompleteIndex - 1 + suggestions.length) % suggestions.length;
				return true;
			case 'Enter':
			case 'Tab':
				event.preventDefault();
				confirmSuggestion(suggestions[autocompleteIndex]);
				return true;
			case 'Escape':
				event.preventDefault();
				showAutocomplete = false;
				return true;
			default:
				return false;
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (ghostText && cursorAtEnd && (event.key === 'Tab' || event.key === 'ArrowRight')) {
			event.preventDefault();
			acceptGhostText();
			return;
		}

		if (handleAutocompleteKeydown(event)) return;

		if (event.key === 'Escape') {
			clearSearch();
		}

		if (event.key === 'Backspace' && inputText === '' && activeFilters.length > 0) {
			activeFilters.pop();
			emitQuery();
		}
	}

	function confirmSuggestion(suggestion: FilterSuggestion) {
		if (suggestion.raw.endsWith(':')) {
			const words = inputText.split(/\s+/);
			words[words.length - 1] = suggestion.raw;
			inputText = words.join(' ');
			showAutocomplete = false;
			updateAutocomplete();
			emitQuery();
			inputEl?.focus();
			return;
		}

		const parsed = parseClientFilters(suggestion.raw);
		if (parsed.filters.length > 0) {
			addFilterIfNew(parsed.filters[0]);
		}

		const words = inputText.split(/\s+/);
		words.pop();
		inputText = words.length > 0 ? words.join(' ') + ' ' : '';

		showAutocomplete = false;
		emitQuery();
		inputEl?.focus();
	}

	function matchStaticByPrefixAndValue(prefix: string, currentWord: string): FilterSuggestion[] {
		return STATIC_SUGGESTIONS.filter(
			(s) => s.raw.startsWith(`${prefix}:`) && s.raw.toLowerCase().includes(currentWord)
		);
	}

	function matchDynamicValues(
		prefix: string,
		partial: string,
		values: string[]
	): FilterSuggestion[] {
		return values
			.filter((v) => v.toLowerCase().includes(partial))
			.map((v) => ({
				raw: `${prefix}:${v}`,
				label: `${prefix}:${v}`,
				description: `Filter by ${prefix}`
			}));
	}

	function matchPrefixedToken(currentWord: string): FilterSuggestion[] {
		const colonIdx = currentWord.indexOf(':');
		const prefix = currentWord.slice(0, colonIdx);
		const partial = currentWord.slice(colonIdx + 1);

		if (prefix === 'is' || prefix === 'has' || prefix === 'mode') {
			return matchStaticByPrefixAndValue(prefix, currentWord);
		}

		if (prefix === 'tool') {
			fetchDynamicSuggestions();
			return matchDynamicValues('tool', partial, dynamicTools);
		}

		if (prefix === 'branch') {
			fetchDynamicSuggestions();
			return matchDynamicValues('branch', partial, dynamicBranches);
		}

		return [];
	}

	// Dropdown only appears for value completions (after ':');
	// prefix-only matches use ghost text instead.
	function updateAutocomplete() {
		const words = inputText.split(/\s+/);
		const currentWord = words[words.length - 1]?.toLowerCase() || '';

		if (!currentWord || !currentWord.includes(':')) {
			showAutocomplete = false;
			suggestions = [];
			return;
		}

		const matched = matchPrefixedToken(currentWord);

		suggestions = matched.slice(0, MAX_SUGGESTIONS);
		autocompleteIndex = 0;
		showAutocomplete = matched.length > 0;
	}

	function fetchDynamicSuggestions() {
		if (dynamicFetched) return;
		dynamicFetched = true;
		fetch('/api/filter-suggestions')
			.then((r) => r.json())
			.then((data: { tools: string[]; branches: string[] }) => {
				dynamicTools = data.tools;
				dynamicBranches = data.branches;
				updateAutocomplete();
			})
			.catch((err) => {
				if (import.meta.env.DEV) console.warn('[search] Filter suggestions fetch failed:', err);
				dynamicFetched = false;
			});
	}

	function removeFilter(index: number) {
		activeFilters.splice(index, 1);
		emitQuery();
		inputEl?.focus();
	}

	function toggleFilterFromPopover(filter: ParsedFilter) {
		const existingIndex = activeFilters.findIndex((f) => filtersMatch(f, filter));
		if (existingIndex >= 0) {
			activeFilters.splice(existingIndex, 1);
		} else {
			activeFilters.push(filter);
		}
		emitQuery();
	}

	function clearSearch() {
		activeFilters = [];
		inputText = '';
		query = '';
		showAutocomplete = false;
		showPopover = false;
		onSearch('');
		inputEl?.focus();
	}

	let hasContent = $derived(activeFilters.length > 0 || inputText.length > 0);
</script>

<div bind:this={containerEl} class="relative mb-6">
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="input-glow border-surface-800 bg-surface-900 focus-within:border-accent-500/50 flex min-h-[52px] items-center gap-1.5 rounded-xl border px-4 transition-colors"
		onclick={() => inputEl?.focus()}
	>
		<svg
			class="text-text-500 h-5 w-5 shrink-0"
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

		{#each activeFilters as filter, i (filter.raw)}
			<FilterPill prefix={filter.prefix} value={filter.value} onremove={() => removeFilter(i)} />
		{/each}

		<div class="relative min-w-[120px] flex-1">
			<input
				bind:this={inputEl}
				bind:value={inputText}
				oninput={handleInput}
				onkeydown={handleKeydown}
				onkeyup={updateCursorAtEnd}
				onclick={updateCursorAtEnd}
				onfocus={() => {
					updateCursorAtEnd();
					updateAutocomplete();
				}}
				onblur={() => {
					cursorAtEnd = false;
					setTimeout(() => (showAutocomplete = false), BLUR_CLOSE_DELAY_MS);
				}}
				type="text"
				placeholder={activeFilters.length > 0
					? 'Add more filters or text...'
					: 'Search sessions...'}
				class="text-text-100 placeholder-text-500 w-full bg-transparent py-3.5 text-base outline-none"
			/>
			{#if ghostText}
				<span
					class="pointer-events-none absolute inset-0 overflow-hidden py-3.5 text-base whitespace-pre"
					aria-hidden="true"
				>
					<span class="invisible">{inputText}</span><span class="text-text-500/40">{ghostText}</span
					>
				</span>
			{/if}
			<span
				bind:this={measureEl}
				class="invisible absolute top-0 left-0 py-3.5 text-base whitespace-pre"
				aria-hidden="true">{measureText}</span
			>
		</div>

		<button
			onclick={() => (showPopover = !showPopover)}
			class={`shrink-0 rounded-md p-1.5 transition-colors ${
				showPopover ? 'bg-accent-500/10 text-accent-300' : 'text-text-500 hover:text-text-300'
			}`}
			aria-label="Filter options"
		>
			<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
				/>
			</svg>
		</button>

		{#if hasContent}
			<button
				onclick={clearSearch}
				class="text-text-500 hover:text-text-300 shrink-0 transition-colors"
				aria-label="Clear search"
			>
				<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
				</svg>
			</button>
		{/if}
	</div>

	{#if showAutocomplete && suggestions.length > 0}
		<div
			class="border-surface-800 bg-surface-900 absolute z-50 mt-1 overflow-hidden rounded-lg border shadow-lg"
			style="left: {dropdownLeft}px; min-width: {DROPDOWN_MIN_WIDTH}px; max-width: 300px;"
		>
			{#each suggestions as suggestion, i (suggestion.raw)}
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div
					class={`flex cursor-pointer items-center justify-between gap-3 px-4 py-2.5 text-sm transition-colors ${
						i === autocompleteIndex
							? 'bg-accent-500/10 text-accent-300'
							: 'text-text-300 hover:bg-surface-800'
					}`}
					onmousedown={() => confirmSuggestion(suggestion)}
					onmouseenter={() => (autocompleteIndex = i)}
				>
					<span class="font-mono text-xs">{suggestion.label}</span>
					<span class="text-text-500 text-xs whitespace-nowrap">{suggestion.description}</span>
				</div>
			{/each}
		</div>
	{/if}

	{#if showPopover}
		<FilterPopover
			{activeFilters}
			onToggleFilter={toggleFilterFromPopover}
			onClose={() => (showPopover = false)}
		/>
	{/if}
</div>
