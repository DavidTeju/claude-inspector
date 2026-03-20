<script lang="ts">
	import { X } from '@lucide/svelte';
	import { fade } from 'svelte/transition';
	import { searchOverlay } from '$lib/stores/search-overlay.svelte.js';
	import SearchInput from './SearchInput.svelte';
	import SearchPanel from './SearchPanel.svelte';

	let searchQuery = $state('');
	let showResults = $derived(searchQuery.length >= 2);

	function executeSearch(query: string) {
		searchQuery = query;
	}

	function close() {
		searchOverlay.hide();
		searchQuery = '';
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			close();
		}
	}

	function handleBackdropClick(event: MouseEvent) {
		if (event.target === event.currentTarget) {
			close();
		}
	}
</script>

{#if searchOverlay.open}
	<div
		class="bg-surface-950/90 fixed inset-0 z-50 overflow-y-auto backdrop-blur-sm"
		transition:fade={{ duration: 150 }}
		onkeydown={handleKeydown}
		onclick={handleBackdropClick}
	>
		<div class="mx-auto max-w-3xl px-4 pt-8">
			<button
				onclick={close}
				class="text-text-500 hover:text-text-100 absolute top-4 right-4 rounded-md p-2 transition-colors"
				aria-label="Close search"
			>
				<X class="h-5 w-5" />
			</button>

			<SearchInput bind:query={searchQuery} onSearch={executeSearch} />

			{#if showResults}
				<SearchPanel query={searchQuery} />
			{/if}
		</div>
	</div>
{/if}
