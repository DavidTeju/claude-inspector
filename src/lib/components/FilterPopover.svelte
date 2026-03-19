<script lang="ts">
	import { onMount } from 'svelte';
	import { filterPresets } from '$lib/stores/filter-presets.svelte.js';
	import type { ParsedFilter } from '$lib/utils.js';

	const MAX_FILTER_ITEMS = 100;

	let {
		activeFilters,
		onToggleFilter,
		onClose,
		onLoadPreset
	}: {
		activeFilters: ParsedFilter[];
		onToggleFilter: (filter: ParsedFilter) => void;
		onClose: () => void;
		onLoadPreset: (query: string) => void;
	} = $props();

	interface FilterSectionConfig {
		prefix: string;
		label: string;
		placeholder: string;
	}

	const FILTER_SECTIONS: FilterSectionConfig[] = [
		{ prefix: 'project', label: 'Project', placeholder: 'search projects...' },
		{ prefix: 'model', label: 'Model', placeholder: 'search models...' }
	];

	const BOOLEAN_FILTERS: Array<{ prefix: string; value: string; label: string }> = [
		{ prefix: 'has', value: 'error', label: 'Has errors' },
		{ prefix: 'is', value: 'subagent', label: 'Subagent' }
	];

	let sectionData: Record<string, { items: string[]; search: string }> = $state(
		Object.fromEntries(FILTER_SECTIONS.map((s) => [s.prefix, { items: [], search: '' }]))
	);

	function filteredItems(prefix: string): string[] {
		const data = sectionData[prefix];
		if (!data.search) return data.items.slice(0, MAX_FILTER_ITEMS);
		const lower = data.search.toLowerCase();
		return data.items.filter((v) => v.toLowerCase().includes(lower)).slice(0, MAX_FILTER_ITEMS);
	}

	function filterState(prefix: string, value: string): 'include' | 'exclude' | 'off' {
		const match = activeFilters.find(
			(f) => f.prefix === prefix && f.value.toLowerCase() === value.toLowerCase()
		);
		if (!match) return 'off';
		return match.negated ? 'exclude' : 'include';
	}

	const TOGGLE_CLASSES: Record<string, string> = {
		include: 'border-accent-500/50 bg-primary/10 text-accent-300',
		exclude: 'border-red-500/30 bg-red-500/10 text-red-400',
		off: 'border-surface-800 bg-card/50 text-muted-foreground hover:border-border hover:text-text-100'
	};

	const LIST_ITEM_CLASSES: Record<string, string> = {
		include: 'bg-accent-500/10 text-accent-300',
		exclude: 'bg-red-500/10 text-red-400',
		off: 'text-text-500 hover:bg-accent/50 hover:text-text-100'
	};

	function cycleFilter(prefix: string, value: string) {
		const state = filterState(prefix, value);
		if (state === 'off') {
			onToggleFilter({ prefix, value, raw: `${prefix}:${value}`, negated: false });
		} else if (state === 'include') {
			onToggleFilter({ prefix, value, raw: `${prefix}:${value}`, negated: false });
			onToggleFilter({ prefix, value, raw: `-${prefix}:${value}`, negated: true });
		} else {
			onToggleFilter({ prefix, value, raw: `-${prefix}:${value}`, negated: true });
		}
	}

	onMount(() => {
		fetch('/api/filter-suggestions')
			.then((r) => r.json())
			.then((data: { projects: string[]; models: string[] }) => {
				sectionData.project.items = data.projects;
				sectionData.model.items = data.models;
			})
			.catch((err) => {
				if (import.meta.env.DEV) console.warn('[filter] Suggestions fetch failed:', err);
			});
	});

	let popoverEl = $state<HTMLDivElement>();

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			onClose();
		}
	}

	function handlePointerDown(event: PointerEvent) {
		if (popoverEl && !popoverEl.contains(event.target as Node)) {
			onClose();
		}
	}
</script>

{#snippet filterSection(config: FilterSectionConfig)}
	{@const data = sectionData[config.prefix]}
	{@const filtered = filteredItems(config.prefix)}
	<div class="border-border/50 mb-4 rounded-lg border p-2.5">
		<span
			class="text-muted-foreground mb-2 block text-[11px] font-semibold tracking-widest uppercase"
			>{config.label}</span
		>
		<input
			bind:value={data.search}
			type="text"
			placeholder={config.placeholder}
			class="border-border bg-background text-foreground placeholder-muted-foreground focus:border-primary/50 mb-2 w-full rounded-lg border px-3 py-1.5 text-xs transition-colors outline-none"
		/>
		<div
			class="border-border/30 bg-background/50 max-h-32 space-y-0.5 overflow-y-auto rounded border"
		>
			{#each filtered as item (item)}
				{@const state = filterState(config.prefix, item)}
				<button
					onclick={() => cycleFilter(config.prefix, item)}
					class="w-full rounded-md px-2.5 py-1 text-left text-xs transition-colors {LIST_ITEM_CLASSES[
						state
					]}"
				>
					{state === 'exclude' ? 'NOT ' : ''}{item}
				</button>
			{:else}
				<p class="text-muted-foreground px-2.5 py-1 text-xs">
					{data.items.length === 0 ? 'Loading...' : 'No matches'}
				</p>
			{/each}
		</div>
	</div>
{/snippet}

<svelte:window onkeydown={handleKeydown} onpointerdown={handlePointerDown} />

<div
	bind:this={popoverEl}
	class="border-border bg-card animate-fade-in-up absolute top-full right-0 z-50 mt-2 max-h-[70vh] w-80 overflow-y-auto rounded-xl border p-4 shadow-lg"
	style="animation-duration: 150ms"
>
	<!-- Boolean toggles -->
	<div class="mb-4">
		<span
			class="text-muted-foreground mb-2 block text-[11px] font-semibold tracking-widest uppercase"
			>Filters</span
		>
		<div class="flex flex-wrap gap-1.5">
			{#each BOOLEAN_FILTERS as bf (bf.prefix + bf.value)}
				{@const state = filterState(bf.prefix, bf.value)}
				{@const stateClass = TOGGLE_CLASSES[state]}
				<button
					onclick={() => cycleFilter(bf.prefix, bf.value)}
					class="rounded-md border px-2.5 py-1 text-xs transition-colors {stateClass}"
				>
					{state === 'exclude' ? 'NOT ' : ''}{bf.label}
				</button>
			{/each}
		</div>
	</div>

	<!-- Value filter sections -->
	{#each FILTER_SECTIONS as config (config.prefix)}
		<!-- eslint-disable-next-line sonarjs/no-use-of-empty-return-value -->
		{@render filterSection(config)}
	{/each}

	<!-- Presets -->
	{#if filterPresets.list.length > 0}
		<div class="border-border border-t pt-4">
			<span
				class="text-muted-foreground mb-2 block text-[11px] font-semibold tracking-widest uppercase"
				>Presets</span
			>
			<div class="space-y-1">
				{#each filterPresets.list as preset (preset.name)}
					<div class="flex items-center justify-between gap-2">
						<button
							onclick={() => onLoadPreset(preset.query)}
							class="text-muted-foreground hover:text-foreground min-w-0 flex-1 truncate rounded-md px-2.5 py-1 text-left text-xs transition-colors"
							title={preset.query}
						>
							{preset.name}
						</button>
						<button
							onclick={() => filterPresets.remove(preset.name)}
							class="text-muted-foreground shrink-0 p-1 text-xs transition-colors hover:text-red-400"
							aria-label="Delete preset {preset.name}"
						>
							<svg
								class="h-3 w-3"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								stroke-width="2"
							>
								<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
							</svg>
						</button>
					</div>
				{/each}
			</div>
		</div>
	{/if}
</div>
