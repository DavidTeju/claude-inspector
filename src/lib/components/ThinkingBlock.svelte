<script lang="ts">
	import CollapsibleSection from './CollapsibleSection.svelte';

	let { content }: { content: string } = $props();

	let charCount = $derived(content.length.toLocaleString());
</script>

<CollapsibleSection accentClass="border-l-surface-600/40">
	{#snippet header()}
		<span class="text-muted-foreground italic">Thinking</span>
		<span class="text-muted-foreground/50 text-[10px]">{charCount} chars</span>
	{/snippet}

	<pre
		class="text-muted-foreground max-h-96 overflow-auto text-xs leading-relaxed whitespace-pre-wrap">{content}</pre>
</CollapsibleSection>
