<script lang="ts">
	import { onMount } from 'svelte';
	import type { ParsedFilter } from '$lib/utils.js';

	let {
		activeFilters,
		onToggleFilter,
		onClose
	}: {
		activeFilters: ParsedFilter[];
		onToggleFilter: (filter: ParsedFilter) => void;
		onClose: () => void;
	} = $props();

	let toolSearch = $state('');
	let branchSearch = $state('');
	let tools: string[] = $state([]);
	let branches: string[] = $state([]);

	const BOOLEAN_FILTERS: Array<{ prefix: string; value: string; label: string }> = [
		{ prefix: 'is', value: 'error', label: 'Has errors' },
		{ prefix: 'is', value: 'subagent', label: 'Subagent' },
		{ prefix: 'has', value: 'cost', label: 'Has token cost' },
		{ prefix: 'mode', value: 'raw', label: 'Raw mode' }
	];

	let filteredTools = $derived(
		tools.filter((t) => t.toLowerCase().includes(toolSearch.toLowerCase()))
	);
	let filteredBranches = $derived(
		branches.filter((b) => b.toLowerCase().includes(branchSearch.toLowerCase()))
	);

	function isActive(prefix: string, value: string): boolean {
		return activeFilters.some(
			(f) => f.prefix === prefix && f.value.toLowerCase() === value.toLowerCase()
		);
	}

	function toggle(prefix: string, value: string) {
		onToggleFilter({ prefix, value, raw: `${prefix}:${value}` });
	}

	onMount(() => {
		fetch('/api/filter-suggestions')
			.then((r) => r.json())
			.then((data: { tools: string[]; branches: string[] }) => {
				tools = data.tools;
				branches = data.branches;
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

<svelte:window onkeydown={handleKeydown} onpointerdown={handlePointerDown} />

<div
	bind:this={popoverEl}
	class="border-surface-800 bg-surface-900 animate-fade-in-up absolute top-full right-0 z-50 mt-2 w-80 rounded-xl border p-4 shadow-lg"
	style="animation-duration: 150ms"
>
	<!-- Boolean toggles -->
	<div class="mb-4">
		<span class="section-label mb-2 block">Filters</span>
		<div class="flex flex-wrap gap-1.5">
			{#each BOOLEAN_FILTERS as bf (bf.prefix + bf.value)}
				<button
					onclick={() => toggle(bf.prefix, bf.value)}
					class={`rounded-md border px-2.5 py-1 text-xs transition-colors ${
						isActive(bf.prefix, bf.value)
							? 'border-accent-500/50 bg-accent-500/10 text-accent-300'
							: 'border-surface-800 bg-surface-900/50 text-text-500 hover:border-surface-700 hover:text-text-100'
					}`}
				>
					{bf.label}
				</button>
			{/each}
		</div>
	</div>

	<!-- Tool filter -->
	<div class="mb-4">
		<span class="section-label mb-2 block">Tool</span>
		<input
			bind:value={toolSearch}
			type="text"
			placeholder="Filter tools..."
			class="border-surface-800 bg-surface-950 text-text-100 placeholder-text-500 focus:border-accent-500/50 mb-2 w-full rounded-lg border px-3 py-1.5 text-xs transition-colors outline-none"
		/>
		<div class="max-h-32 space-y-0.5 overflow-y-auto">
			{#each filteredTools as tool (tool)}
				<button
					onclick={() => toggle('tool', tool)}
					class={`w-full rounded-md px-2.5 py-1 text-left text-xs transition-colors ${
						isActive('tool', tool)
							? 'bg-accent-500/10 text-accent-300'
							: 'text-text-500 hover:bg-surface-800 hover:text-text-100'
					}`}
				>
					{tool}
				</button>
			{:else}
				<p class="text-text-500 px-2.5 py-1 text-xs">
					{tools.length === 0 ? 'Loading...' : 'No matches'}
				</p>
			{/each}
		</div>
	</div>

	<!-- Branch filter -->
	<div>
		<span class="section-label mb-2 block">Branch</span>
		<input
			bind:value={branchSearch}
			type="text"
			placeholder="Filter branches..."
			class="border-surface-800 bg-surface-950 text-text-100 placeholder-text-500 focus:border-accent-500/50 mb-2 w-full rounded-lg border px-3 py-1.5 text-xs transition-colors outline-none"
		/>
		<div class="max-h-32 space-y-0.5 overflow-y-auto">
			{#each filteredBranches as branch (branch)}
				<button
					onclick={() => toggle('branch', branch)}
					class={`w-full rounded-md px-2.5 py-1 text-left text-xs transition-colors ${
						isActive('branch', branch)
							? 'bg-accent-500/10 text-accent-300'
							: 'text-text-500 hover:bg-surface-800 hover:text-text-100'
					}`}
				>
					{branch}
				</button>
			{:else}
				<p class="text-text-500 px-2.5 py-1 text-xs">
					{branches.length === 0 ? 'Loading...' : 'No matches'}
				</p>
			{/each}
		</div>
	</div>
</div>
