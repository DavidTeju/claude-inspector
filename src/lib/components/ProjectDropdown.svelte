<script lang="ts">
	import { Check, ChevronDown, Folder } from '@lucide/svelte';
	import type { Project } from '$lib/types.js';

	let {
		projects,
		selectedId = $bindable<string | null>(null)
	}: {
		projects: Project[];
		selectedId: string | null;
	} = $props();

	let isOpen = $state(false);
	let search = $state('');
	let listEl: HTMLDivElement | undefined = $state(undefined);
	let highlightIndex = $state(0);

	let selectedLabel = $derived(
		selectedId ? (projects.find((p) => p.id === selectedId)?.displayName ?? 'Unknown') : null
	);

	let filtered = $derived.by(() => {
		if (!search) return projects;
		const lower = search.toLowerCase();
		return projects.filter((p) => p.displayName.toLowerCase().includes(lower));
	});

	function select(id: string | null) {
		selectedId = id;
		isOpen = false;
		search = '';
	}

	function handleKeydown(event: KeyboardEvent) {
		if (!isOpen) return;
		switch (event.key) {
			case 'ArrowDown':
				event.preventDefault();
				highlightIndex = Math.min(highlightIndex + 1, filtered.length);
				break;
			case 'ArrowUp':
				event.preventDefault();
				highlightIndex = Math.max(highlightIndex - 1, 0);
				break;
			case 'Enter':
				event.preventDefault();
				if (highlightIndex === 0) {
					select(null);
				} else {
					select(filtered[highlightIndex - 1]?.id ?? null);
				}
				break;
			case 'Escape':
				event.preventDefault();
				isOpen = false;
				search = '';
				break;
		}
	}

	function handlePointerDown(event: PointerEvent) {
		if (listEl && !listEl.contains(event.target as Node)) {
			isOpen = false;
			search = '';
		}
	}
</script>

<svelte:window onpointerdown={handlePointerDown} />

<div class="relative" bind:this={listEl}>
	<button
		onclick={() => {
			isOpen = !isOpen;
			if (isOpen && selectedId) {
				const idx = filtered.findIndex((p) => p.id === selectedId);
				highlightIndex = idx >= 0 ? idx + 1 : 0;
			} else {
				highlightIndex = 0;
			}
			search = '';
		}}
		class="flex items-center gap-2 rounded-lg border px-3 py-2 text-xs transition-colors {selectedId
			? 'border-accent-500/50 bg-accent-500/10 text-accent-300 hover:bg-accent-500/20'
			: 'border-surface-800 bg-surface-900/50 text-text-300 hover:border-surface-700 hover:text-text-100'}"
	>
		<Folder class="text-text-500 h-3.5 w-3.5 shrink-0" />
		<span class="max-w-[12rem] truncate">{selectedLabel ?? 'All projects'}</span>
		<ChevronDown
			class="text-text-500 h-3 w-3 shrink-0 transition-transform {isOpen ? 'rotate-180' : ''}"
		/>
	</button>

	{#if isOpen}
		<div
			class="border-surface-800 bg-surface-900 animate-fade-in-up absolute top-full left-0 z-50 mt-1 w-64 overflow-hidden rounded-lg border shadow-lg"
			style="animation-duration: 150ms"
			onkeydown={handleKeydown}
		>
			<div class="p-2">
				<input
					bind:value={search}
					type="text"
					placeholder="Search projects..."
					class="border-surface-800 bg-surface-950 text-text-100 placeholder-text-500 focus:border-accent-500/50 w-full rounded-md border px-2.5 py-1.5 text-xs outline-none"
					autofocus
				/>
			</div>

			<div class="max-h-48 overflow-y-auto">
				<div
					class="flex cursor-pointer items-center gap-2 px-3 py-2 text-xs transition-colors {highlightIndex ===
					0
						? 'bg-accent-500/10 text-accent-300'
						: 'text-text-500 hover:bg-surface-800/50 hover:text-text-100'}"
					onmousedown={() => select(null)}
					onmouseenter={() => (highlightIndex = 0)}
				>
					{#if !selectedId}
						<Check class="h-3 w-3 shrink-0" stroke-width="2.5" />
					{:else}
						<span class="inline-block h-3 w-3 shrink-0"></span>
					{/if}
					All projects
				</div>

				{#each filtered as project, i (project.id)}
					<div
						class="flex cursor-pointer items-center gap-2 px-3 py-2 text-xs transition-colors {highlightIndex ===
						i + 1
							? 'bg-accent-500/10 text-accent-300'
							: 'text-text-300 hover:bg-surface-800/50 hover:text-text-100'}"
						onmousedown={() => select(project.id)}
						onmouseenter={() => (highlightIndex = i + 1)}
					>
						{#if selectedId === project.id}
							<Check class="h-3 w-3 shrink-0" stroke-width="2.5" />
						{:else}
							<span class="inline-block h-3 w-3 shrink-0"></span>
						{/if}
						{project.displayName}
					</div>
				{:else}
					<div class="text-text-500 px-3 py-2 text-xs">No matches</div>
				{/each}
			</div>
		</div>
	{/if}
</div>
