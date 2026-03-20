<script lang="ts">
	import { Plus } from '@lucide/svelte';
	import BrandingHeader from '$lib/components/BrandingHeader.svelte';
	import ProjectDropdown from '$lib/components/ProjectDropdown.svelte';
	import RecentSessionCard from '$lib/components/RecentSessionCard.svelte';
	import SearchInput from '$lib/components/SearchInput.svelte';
	import SearchPanel from '$lib/components/SearchPanel.svelte';
	import { STAGGER_BASE_MS, STAGGER_DELAY_MS } from '$lib/constants.js';
	import { newSessionModal } from '$lib/stores/new-session-modal.svelte.js';
	import type { ParsedFilter } from '$lib/utils.js';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';

	type HomeState = 'landing' | 'focused' | 'searching';

	const BLUR_RETURN_DELAY_MS = 200;

	let { data } = $props();

	let searchQuery = $state('');
	let searchFocused = $state(false);
	let selectedProjectId = $state<string | null>(data.selectedProjectId);

	// Track the server-provided value to avoid a goto on initial load
	let lastServerProjectId = data.selectedProjectId;

	let homeState: HomeState = $derived.by(() => {
		if (searchQuery.length >= 2) return 'searching';
		if (searchFocused) return 'focused';
		return 'landing';
	});

	let isLanding = $derived(homeState === 'landing');

	let externalFilters: ParsedFilter[] = $derived.by(() => {
		if (!selectedProjectId) return [];
		const project = data.projects.find((p) => p.id === selectedProjectId);
		if (!project) return [];
		return [
			{
				prefix: 'project',
				value: project.displayName,
				raw: `project:${project.displayName}`,
				negated: false
			}
		];
	});

	$effect(() => {
		// Skip goto when the value matches what the server already sent
		if (selectedProjectId === lastServerProjectId) return;
		lastServerProjectId = selectedProjectId;
		const path = selectedProjectId ? `/?project=${selectedProjectId}` : '/';
		goto(resolve(path as '/'), { replaceState: true, noScroll: true });
	});

	// Sync selectedProjectId when server data changes (e.g. after navigation)
	$effect(() => {
		selectedProjectId = data.selectedProjectId;
		lastServerProjectId = data.selectedProjectId;
	});

	function handleSearch(query: string) {
		searchQuery = query;
	}

	function handleFocus() {
		searchFocused = true;
	}

	function handleClear() {
		searchFocused = false;
	}

	function handleRemoveExternalFilter() {
		selectedProjectId = null;
	}

	let blurTimer: ReturnType<typeof setTimeout> | undefined;

	function handleFocusOut(event: FocusEvent) {
		const container = event.currentTarget as HTMLElement;
		const newTarget = event.relatedTarget as Node | null;
		if (newTarget && container.contains(newTarget)) return;
		clearTimeout(blurTimer);
		blurTimer = setTimeout(() => {
			if (searchQuery.length < 2) {
				searchFocused = false;
			}
		}, BLUR_RETURN_DELAY_MS);
	}
</script>

<svelte:head>
	<title>Sessionaut</title>
</svelte:head>

<div class="mx-auto max-w-4xl px-4">
	{#if isLanding}
		<BrandingHeader />
	{/if}

	<div
		class="mx-auto w-full transition-all duration-300 {isLanding ? 'max-w-xl' : 'max-w-3xl'}"
		style="transition-timing-function: var(--ease-spring, ease)"
	>
		<div onfocusout={handleFocusOut}>
			<SearchInput
				bind:query={searchQuery}
				onSearch={handleSearch}
				compact={isLanding}
				autofocus={false}
				onFocus={handleFocus}
				onClear={handleClear}
				{externalFilters}
				onRemoveExternalFilter={handleRemoveExternalFilter}
			/>
		</div>

		<div class="mt-4 flex flex-wrap items-center gap-3">
			<ProjectDropdown projects={data.projects} bind:selectedId={selectedProjectId} />

			<button
				onclick={() => newSessionModal.show()}
				class="border-accent-500/50 bg-accent-500/10 text-accent-300 hover:bg-accent-500/20 flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs transition-colors"
			>
				<Plus class="h-3.5 w-3.5" />
				New Session
			</button>
		</div>

		{#if homeState === 'searching'}
			<div class="mt-6">
				<SearchPanel query={searchQuery} />
			</div>
		{:else}
			<div class="mt-6">
				<h2 class="section-title mb-4">Recent sessions</h2>

				{#if data.recentSessions.length > 0}
					<div class="space-y-2">
						{#each data.recentSessions as session, i (session.projectId + '/' + session.sessionId)}
							<div
								class="animate-fade-in-up"
								style="animation-delay: {Math.min(i, STAGGER_DELAY_MS) * STAGGER_BASE_MS}ms"
							>
								<RecentSessionCard {session} />
							</div>
						{/each}
					</div>
				{:else}
					<div class="text-text-500 py-12 text-center">
						<p class="text-sm">No recent sessions</p>
						<p class="mt-1 text-xs">Start a new session or select a different project</p>
					</div>
				{/if}
			</div>
		{/if}
	</div>
</div>
