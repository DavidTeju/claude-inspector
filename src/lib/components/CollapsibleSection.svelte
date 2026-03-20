<script lang="ts">
	import { ChevronRight } from '@lucide/svelte';
	import type { Snippet } from 'svelte';
	// eslint-disable-next-line import-x/no-duplicates
	import { cubicOut } from 'svelte/easing';
	// eslint-disable-next-line import-x/no-duplicates
	import { slide } from 'svelte/transition';

	let {
		header,
		children,
		defaultExpanded = false,
		accentClass = '',
		bodyClass = ''
	}: {
		header: Snippet;
		children: Snippet;
		defaultExpanded?: boolean;
		accentClass?: string;
		bodyClass?: string;
	} = $props();

	let expanded = $state(defaultExpanded);
</script>

<div class="bg-surface-850/50 rounded-md border-l-2 {accentClass}">
	<button
		onclick={() => (expanded = !expanded)}
		class="hover:bg-surface-800/30 flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors"
	>
		<ChevronRight
			class="text-text-500 h-3 w-3 flex-shrink-0 transition-transform duration-200 {expanded
				? 'rotate-90'
				: ''}"
		/>

		{@render header()}
	</button>

	{#if expanded}
		<div
			transition:slide={{ duration: 250, easing: cubicOut }}
			class="border-surface-800/40 border-t px-3 py-2 {bodyClass}"
		>
			{@render children()}
		</div>
	{/if}
</div>
