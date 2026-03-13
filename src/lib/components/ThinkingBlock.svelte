<script lang="ts">
	import { slide } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';

	let { content }: { content: string } = $props();
	let expanded = $state(false);

	let charCount = $derived(content.length.toLocaleString());
</script>

<div class="border-l-surface-600/40 bg-surface-850/50 mb-2 rounded-md border-l-2">
	<button
		onclick={() => (expanded = !expanded)}
		class="hover:bg-surface-800/20 flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors"
	>
		<svg
			class="text-text-700 h-3 w-3 flex-shrink-0 transition-transform duration-200 {expanded
				? 'rotate-90'
				: ''}"
			fill="none"
			viewBox="0 0 24 24"
			stroke="currentColor"
			stroke-width="2"
		>
			<path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
		</svg>
		<span class="text-text-500 italic">Thinking</span>
		<span class="text-text-700 text-[10px]">{charCount} chars</span>
	</button>

	{#if expanded}
		<div
			transition:slide={{ duration: 250, easing: cubicOut }}
			class="border-surface-800/30 border-t px-3 py-2"
		>
			<pre
				class="text-text-500 max-h-96 overflow-auto text-xs leading-relaxed whitespace-pre-wrap">{content}</pre>
		</div>
	{/if}
</div>
