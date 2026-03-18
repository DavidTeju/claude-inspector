<script lang="ts">
	let { resultText }: { resultText: string } = $props();
</script>

<pre
	class="bg-surface-950 text-text-300 max-h-96 overflow-auto rounded-md p-2 font-mono text-[11px] leading-relaxed break-words whitespace-pre-wrap">{resultText}</pre>
