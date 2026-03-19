<script lang="ts">
	import CollapsibleSection from './CollapsibleSection.svelte';

	let { content }: { content: string } = $props();

	let charCount = $derived(content.length.toLocaleString());
</script>

<CollapsibleSection accentClass="border-l-neutral/40">
	{#snippet header()}
		<span class="text-base-content/50 italic">Thinking</span>
		<span class="text-base-content/30 text-[10px]">{charCount} chars</span>
	{/snippet}

	<pre
		class="text-base-content/50 max-h-96 overflow-auto text-xs leading-relaxed whitespace-pre-wrap">{content}</pre>
</CollapsibleSection>
