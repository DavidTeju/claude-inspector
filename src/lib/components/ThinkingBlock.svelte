<script lang="ts">
	let { content }: { content: string } = $props();
	let expanded = $state(false);

	let charCount = $derived(content.length.toLocaleString());
</script>

<div class="mb-2 rounded-md border border-zinc-800/30 bg-zinc-950/30">
	<button
		onclick={() => (expanded = !expanded)}
		class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors hover:bg-zinc-800/20"
	>
		<svg
			class="h-3 w-3 flex-shrink-0 text-zinc-700 transition-transform {expanded ? 'rotate-90' : ''}"
			fill="none"
			viewBox="0 0 24 24"
			stroke="currentColor"
			stroke-width="2"
		>
			<path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
		</svg>
		<span class="text-zinc-600 italic">Thinking</span>
		<span class="text-[10px] text-zinc-700">{charCount} chars</span>
	</button>

	{#if expanded}
		<div class="border-t border-zinc-800/30 px-3 py-2">
			<pre
				class="max-h-96 overflow-auto text-xs leading-relaxed whitespace-pre-wrap text-zinc-500">{content}</pre>
		</div>
	{/if}
</div>
