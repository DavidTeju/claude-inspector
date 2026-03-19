<script lang="ts">
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

<div class="bg-base-300/50 rounded-md border-l-2 {accentClass}">
	<button
		onclick={() => (expanded = !expanded)}
		class="btn btn-ghost btn-block h-auto justify-start gap-2 py-2 text-xs"
	>
		<svg
			class="text-base-content/50 h-3 w-3 flex-shrink-0 transition-transform duration-200 {expanded
				? 'rotate-90'
				: ''}"
			fill="none"
			viewBox="0 0 24 24"
			stroke="currentColor"
			stroke-width="2"
		>
			<path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
		</svg>

		{@render header()}
	</button>

	{#if expanded}
		<div
			transition:slide={{ duration: 250, easing: cubicOut }}
			class="border-base-content/10 border-t px-3 py-2 {bodyClass}"
		>
			{@render children()}
		</div>
	{/if}
</div>
