<script lang="ts">
	import CollapsibleSection from './CollapsibleSection.svelte';

	let { content }: { content: string } = $props();

	let charCount = $derived(content.length.toLocaleString());
</script>

<CollapsibleSection accentClass="border-l-surface-600/40">
	{#snippet header()}
		<span class="text-text-500 italic">Thinking</span>
		<span class="text-text-700 text-[10px]">{charCount} chars</span>
	{/snippet}

	<pre
		class="text-text-500 max-h-96 overflow-auto text-xs leading-relaxed whitespace-pre-wrap">{content}</pre>
</CollapsibleSection>
