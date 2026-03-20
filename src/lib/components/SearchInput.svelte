<script lang="ts">
	import { Bookmark, Filter, Search, X } from '@lucide/svelte';
	import { filterPresets } from '$lib/stores/filter-presets.svelte.js';
	import { parseClientFilters, rebuildQuery, type ParsedFilter } from '$lib/utils.js';
	import FilterPill from './FilterPill.svelte';
	import FilterPopover from './FilterPopover.svelte';

	const SEARCH_DEBOUNCE_MS = 300;
	const MAX_SUGGESTIONS = 8;
	const BLUR_CLOSE_DELAY_MS = 150;
	const DROPDOWN_MIN_WIDTH = 180;

	let {
		query = $bindable(''),
		onSearch,
		compact = false,
		autofocus = true,
		onFocus,
		onClear,
		externalFilters = [],
		onRemoveExternalFilter
	}: {
		query: string;
		onSearch: (query: string) => void;
		compact?: boolean;
		autofocus?: boolean;
		onFocus?: () => void;
		onClear?: () => void;
		externalFilters?: ParsedFilter[];
		onRemoveExternalFilter?: (index: number) => void;
	} = $props();

	const initialParsed = query ? parseClientFilters(query) : null;
	let activeFilters: ParsedFilter[] = $state(initialParsed?.filters ?? []);
	let inputText = $state(initialParsed?.freeText ?? '');
	let rawMode = $state(initialParsed?.rawMode ?? false);
	let regexMode = $state(initialParsed?.regexMode ?? false);
	let showPopover = $state(false);
	let showAutocomplete = $state(false);
	let autocompleteIndex = $state(0);
	let inputEl: HTMLInputElement | undefined = $state(undefined);
	let containerEl: HTMLElement | undefined = $state(undefined);
	let measureEl: HTMLElement | undefined = $state(undefined);
	let debounceTimer: ReturnType<typeof setTimeout> | null = null;
	let suggestions: FilterSuggestion[] = $state([]);
	let dynamicValues: Record<string, string[]> = $state({
		project: [],
		model: []
	});
	let dynamicFetched = $state(false);
	let cursorAtEnd = $state(true);
	let dropdownLeft = $state(0);
	let showPresetSave = $state(false);
	let presetName = $state('');

	interface FilterSuggestion {
		raw: string;
		label: string;
		description: string;
	}

	const STATIC_SUGGESTIONS: FilterSuggestion[] = [
		{ raw: 'has:error', label: 'has:error', description: 'Sessions with API errors' },
		{ raw: 'is:subagent', label: 'is:subagent', description: 'Subagent sessions' },
		{ raw: 'mode:raw', label: 'mode:raw', description: 'Full-text search mode' },
		{ raw: 'mode:regex', label: 'mode:regex', description: 'Regex search mode' }
	];

	const PREFIX_SUGGESTIONS: FilterSuggestion[] = [
		{ raw: 'project:', label: 'project:', description: 'Filter by project' },
		{ raw: 'model:', label: 'model:', description: 'Filter by AI model' },
		{ raw: 'date:', label: 'date:', description: 'Filter by date' }
	];

	const ALL_SUGGESTIONS = [...STATIC_SUGGESTIONS, ...PREFIX_SUGGESTIONS];

	function filtersMatch(a: ParsedFilter, b: ParsedFilter): boolean {
		return (
			a.prefix === b.prefix &&
			a.value.toLowerCase() === b.value.toLowerCase() &&
			a.negated === b.negated
		);
	}

	function addFilterIfNew(filter: ParsedFilter) {
		if (!activeFilters.some((f) => filtersMatch(f, filter))) {
			activeFilters.push(filter);
		}
	}

	const DYNAMIC_PREFIXES = new Set(['project', 'model']);

	function absorbModes(parsed: ReturnType<typeof parseClientFilters>) {
		if (parsed.rawMode) rawMode = true;
		if (parsed.regexMode) regexMode = true;
	}

	let ghostText = $derived.by(() => {
		if (!cursorAtEnd || !inputText) return '';
		const words = inputText.split(/\s+/);
		const currentWord = words[words.length - 1]?.toLowerCase() || '';
		if (!currentWord || currentWord.includes(':')) return '';

		const isNeg = currentWord.startsWith('-');
		const matchWord = isNeg ? currentWord.slice(1) : currentWord;
		if (!matchWord) return '';

		for (const s of ALL_SUGGESTIONS) {
			if (s.raw.startsWith(matchWord) && s.raw !== matchWord) {
				return s.raw.slice(matchWord.length);
			}
		}
		return '';
	});

	let measureText = $derived.by(() => {
		const lastSpaceIdx = inputText.lastIndexOf(' ');
		return lastSpaceIdx >= 0 ? inputText.slice(0, lastSpaceIdx + 1) : '';
	});

	let searchModeLabel = $derived.by(() => {
		if (regexMode) return 'REGEX';
		if (rawMode) return 'RAW';
		return '';
	});

	$effect(() => {
		if (autofocus) inputEl?.focus();
	});

	// Position dropdown after DOM flush so measureEl dimensions are current
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
		const modeParts: string[] = [];
		if (rawMode) modeParts.push('mode:raw');
		if (regexMode) modeParts.push('mode:regex');
		const allFilters = [...activeFilters, ...externalFilters];
		const rebuilt = rebuildQuery(allFilters, [...modeParts, inputText].join(' ').trim());
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
			absorbModes(parsed);
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

		// Complete filters (e.g. "has:error") get promoted to pills;
		// prefix-only (e.g. "project:") stays as text so the value dropdown appears
		if (lastWord && !lastWord.endsWith(':')) {
			const parsed = parseClientFilters(lastWord);
			if (parsed.filters.length > 0) {
				for (const filter of parsed.filters) {
					addFilterIfNew(filter);
				}
				words.pop();
				inputText = words.length > 0 ? words.join(' ') + ' ' : '';
			}
			absorbModes(parsed);
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
		absorbModes(parsed);

		const words = inputText.split(/\s+/);
		words.pop();
		inputText = words.length > 0 ? words.join(' ') + ' ' : '';

		showAutocomplete = false;
		emitQuery();
		inputEl?.focus();
	}

	function matchStaticByPrefixAndValue(
		prefix: string,
		currentWord: string,
		negPrefix = ''
	): FilterSuggestion[] {
		return STATIC_SUGGESTIONS.filter(
			(s) => s.raw.startsWith(`${prefix}:`) && s.raw.toLowerCase().includes(currentWord)
		).map((s) =>
			negPrefix
				? {
						raw: `${negPrefix}${s.raw}`,
						label: `${negPrefix}${s.label}`,
						description: s.description
					}
				: s
		);
	}

	const DATE_HINTS = [
		{ value: 'today', description: 'Today' },
		{ value: '7d', description: 'Last 7 days' },
		{ value: '30d', description: 'Last 30 days' }
	];

	function matchPrefixedToken(currentWord: string): FilterSuggestion[] {
		const negated = currentWord.startsWith('-');
		const stripped = negated ? currentWord.slice(1) : currentWord;
		const colonIdx = stripped.indexOf(':');
		if (colonIdx < 0) return [];
		const prefix = stripped.slice(0, colonIdx);
		const partial = stripped.slice(colonIdx + 1);
		const negPrefix = negated ? '-' : '';

		if (prefix === 'is' || prefix === 'has' || prefix === 'mode') {
			return matchStaticByPrefixAndValue(prefix, stripped, negPrefix);
		}

		if (DYNAMIC_PREFIXES.has(prefix)) {
			fetchDynamicSuggestions();
			return (dynamicValues[prefix] ?? [])
				.filter((v) => v.toLowerCase().includes(partial))
				.map((v) => ({
					raw: `${negPrefix}${prefix}:${v}`,
					label: `${negPrefix}${prefix}:${v}`,
					description: `${negated ? 'Exclude' : 'Filter by'} ${prefix}`
				}));
		}

		if (prefix === 'date') {
			return DATE_HINTS.filter((h) => h.value.includes(partial)).map((h) => ({
				raw: `date:${h.value}`,
				label: `date:${h.value}`,
				description: h.description
			}));
		}

		return [];
	}

	// Dropdown only appears for value completions (after ':');
	// prefix-only matches use ghost text instead.
	function updateAutocomplete() {
		const words = inputText.split(/\s+/);
		const currentWord = words[words.length - 1]?.toLowerCase() || '';

		const wordForMatch = currentWord.startsWith('-') ? currentWord.slice(1) : currentWord;
		if (!currentWord || !wordForMatch.includes(':')) {
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
			.then((data: { projects: string[]; models: string[] }) => {
				dynamicValues.project = data.projects;
				dynamicValues.model = data.models;
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

	function toggleFilterNegation(index: number) {
		const filter = activeFilters[index];
		const negated = !filter.negated;
		const raw = negated ? `-${filter.prefix}:${filter.value}` : `${filter.prefix}:${filter.value}`;
		activeFilters[index] = { ...filter, negated, raw };
		emitQuery();
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
		rawMode = false;
		regexMode = false;
		query = '';
		showAutocomplete = false;
		showPopover = false;
		showPresetSave = false;
		onSearch('');
		onClear?.();
		inputEl?.focus();
	}

	function savePreset() {
		const name = presetName.trim();
		if (!name) return;
		filterPresets.save(name, query);
		showPresetSave = false;
		presetName = '';
	}

	function loadPreset(presetQuery: string) {
		const parsed = parseClientFilters(presetQuery);
		activeFilters = parsed.filters;
		inputText = parsed.freeText;
		rawMode = parsed.rawMode;
		regexMode = parsed.regexMode;
		emitQuery();
		showPopover = false;
	}

	let placeholderText = $derived.by(() => {
		if (compact) return 'Search sessions...';
		if (activeFilters.length > 0) return 'Add more filters or text...';
		return 'Search sessions...';
	});

	let hasContent = $derived(
		activeFilters.length > 0 || inputText.length > 0 || rawMode || regexMode
	);
</script>

<div bind:this={containerEl} class="relative w-full {compact ? '' : 'mb-6'}">
	<div
		class="input-glow border-surface-800 bg-surface-900 focus-within:border-accent-500/50 flex items-center gap-1.5 rounded-xl border px-4 transition-all duration-300 {compact
			? 'min-h-[38px]'
			: 'min-h-[52px]'}"
		onclick={() => inputEl?.focus()}
	>
		<Search class="text-text-500 shrink-0 {compact ? 'h-4 w-4' : 'h-5 w-5'}" />

		{#if !compact}
			{#if searchModeLabel}
				<span
					class="shrink-0 rounded border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-amber-400"
				>
					{searchModeLabel}
				</span>
			{/if}

			{#each activeFilters as filter, i (filter.raw + i)}
				<FilterPill
					prefix={filter.prefix}
					value={filter.value}
					negated={filter.negated}
					onremove={() => removeFilter(i)}
					ontogglenegation={() => toggleFilterNegation(i)}
				/>
			{/each}

			{#each externalFilters as filter, i ('ext-' + filter.raw + i)}
				<FilterPill
					prefix={filter.prefix}
					value={filter.value}
					negated={filter.negated}
					onremove={() => onRemoveExternalFilter?.(i)}
				/>
			{/each}
		{/if}

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
					onFocus?.();
				}}
				onblur={() => {
					cursorAtEnd = false;
					setTimeout(() => (showAutocomplete = false), BLUR_CLOSE_DELAY_MS);
				}}
				type="text"
				placeholder={placeholderText}
				class="text-text-100 placeholder-text-500 w-full bg-transparent outline-none {compact
					? 'py-2 text-sm'
					: 'py-3.5 text-base'}"
			/>
			{#if ghostText}
				<span
					class="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre {compact
						? 'py-2 text-sm'
						: 'py-3.5 text-base'}"
					aria-hidden="true"
				>
					<span class="invisible">{inputText}</span><span class="text-text-500/40">{ghostText}</span
					>
				</span>
			{/if}
			<span
				bind:this={measureEl}
				class="invisible absolute top-0 left-0 whitespace-pre {compact
					? 'py-2 text-sm'
					: 'py-3.5 text-base'}"
				aria-hidden="true">{measureText}</span
			>
		</div>

		{#if !compact}
			{#if hasContent}
				<button
					onclick={() => (showPresetSave = !showPresetSave)}
					class="text-text-500 hover:text-text-300 shrink-0 transition-colors"
					aria-label="Save preset"
					title="Save filter preset"
				>
					<Bookmark class="h-4 w-4" />
				</button>
			{/if}

			<button
				onclick={() => (showPopover = !showPopover)}
				class={`shrink-0 rounded-md p-1.5 transition-colors ${
					showPopover ? 'bg-accent-500/10 text-accent-300' : 'text-text-500 hover:text-text-300'
				}`}
				aria-label="Filter options"
			>
				<Filter class="h-4 w-4" />
			</button>

			{#if hasContent}
				<button
					onclick={clearSearch}
					class="text-text-500 hover:text-text-300 shrink-0 transition-colors"
					aria-label="Clear search"
				>
					<X class="h-4 w-4" />
				</button>
			{/if}
		{/if}
	</div>

	{#if showPresetSave}
		<div
			class="border-surface-800 bg-surface-900 absolute top-full right-16 z-50 mt-1 flex items-center gap-2 rounded-lg border p-2 shadow-lg"
		>
			<input
				bind:value={presetName}
				type="text"
				placeholder="Preset name..."
				class="border-surface-800 bg-surface-950 text-text-100 placeholder-text-500 focus:border-accent-500/50 w-40 rounded-md border px-2 py-1 text-xs outline-none"
				onkeydown={(e) => e.key === 'Enter' && savePreset()}
			/>
			<button
				onclick={savePreset}
				class="bg-accent-500/10 text-accent-300 hover:bg-accent-500/20 rounded-md px-2 py-1 text-xs transition-colors"
			>
				Save
			</button>
		</div>
	{/if}

	{#if showAutocomplete && suggestions.length > 0}
		<div
			class="border-surface-800 bg-surface-900 absolute z-50 mt-1 overflow-hidden rounded-lg border shadow-lg"
			style="left: {dropdownLeft}px; min-width: {DROPDOWN_MIN_WIDTH}px; max-width: 300px;"
		>
			{#each suggestions as suggestion, i (suggestion.raw)}
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
			onLoadPreset={loadPreset}
		/>
	{/if}
</div>
