<script lang="ts">
	import CollapsibleSection from './CollapsibleSection.svelte';

	let { content }: { content: string } = $props();

	let charCount = $derived(content.length.toLocaleString());
</script>

<CollapsibleSection
	containerClass="border-l-surface-600/40 bg-surface-850/50 mb-2 rounded-md border-l-2"
	buttonClass="hover:bg-surface-800/20 px-3 py-1.5"
	bodyClass="border-surface-800/30 border-t px-3 py-2"
>
	{#snippet header()}
		<span class="text-text-500 italic">Thinking</span>
		<span class="text-text-700 text-[10px]">{charCount} chars</span>
	{/snippet}

	<pre
		class="text-text-500 max-h-96 overflow-auto text-xs leading-relaxed whitespace-pre-wrap">{content}</pre>
</CollapsibleSection>
