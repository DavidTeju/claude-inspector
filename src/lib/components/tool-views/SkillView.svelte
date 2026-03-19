<script lang="ts">
	import type { ToolCall } from '$lib/types.js';

	const EXPANSION_PREVIEW_LENGTH = 200;

	let { tool, resultText }: { tool: ToolCall; resultText: string } = $props();

	let expansion = $derived(tool.skillExpansion ?? '');
	let expansionPreview = $derived(
		expansion.length > EXPANSION_PREVIEW_LENGTH
			? expansion.slice(0, EXPANSION_PREVIEW_LENGTH) + '…'
			: expansion
	);

	let showFullExpansion = $state(false);
</script>

<div class="space-y-2">
	<!-- Skill result -->
	<div class="bg-surface-950 text-text-300 rounded-md p-3 font-mono text-[11px] leading-relaxed">
		{resultText}
	</div>

	<!-- Skill expansion prompt -->
	{#if expansion}
		<div>
			<button
				onclick={() => (showFullExpansion = !showFullExpansion)}
				class="text-text-500 hover:text-text-300 flex items-center gap-1 text-[10px] transition-colors"
			>
				<svg
					class="h-3 w-3 flex-shrink-0 transition-transform duration-200 {showFullExpansion
						? 'rotate-90'
						: ''}"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="2"
				>
					<path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
				</svg>
				Skill prompt ({expansion.length.toLocaleString()} chars)
			</button>

			{#if showFullExpansion}
				<pre
					class="bg-surface-950 text-text-400 mt-1 max-h-96 overflow-auto rounded-md p-3 font-mono text-[11px] leading-relaxed break-words whitespace-pre-wrap">{expansion}</pre>
			{:else if expansionPreview}
				<pre
					class="bg-surface-950 text-text-500 mt-1 max-h-16 overflow-hidden rounded-md p-3 font-mono text-[10px] leading-relaxed break-words whitespace-pre-wrap">{expansionPreview}</pre>
			{/if}
		</div>
	{/if}
</div>
