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
		containerClass = '',
		buttonClass = '',
		bodyClass = ''
	}: {
		header: Snippet;
		children: Snippet;
		defaultExpanded?: boolean;
		containerClass?: string;
		buttonClass?: string;
		bodyClass?: string;
	} = $props();

	let expanded = $state(defaultExpanded);
</script>

<div class={containerClass}>
	<button
		onclick={() => (expanded = !expanded)}
		class="flex w-full items-center gap-2 text-left text-xs transition-colors {buttonClass}"
	>
		<svg
			class="text-text-500 h-3 w-3 flex-shrink-0 transition-transform duration-200 {expanded
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
		<div transition:slide={{ duration: 250, easing: cubicOut }} class={bodyClass}>
			{@render children()}
		</div>
	{/if}
</div>
