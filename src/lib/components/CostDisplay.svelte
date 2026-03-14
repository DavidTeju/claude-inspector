<script lang="ts">
	import type { SessionCost } from '$lib/shared/active-session-types.js';

	let { cost }: { cost: SessionCost } = $props();

	let expanded = $state(false);
	let containerEl: HTMLDivElement | undefined;

	let formattedTotal = $derived(
		cost.totalUsd < 0.01 ? `$${cost.totalUsd.toFixed(6)}` : `$${cost.totalUsd.toFixed(4)}`
	);

	let modelEntries = $derived(Object.entries(cost.modelUsage));
	let hasMultipleModels = $derived(modelEntries.length > 1);

	$effect(() => {
		if (!expanded) return;

		function handleClickOutside(e: MouseEvent) {
			if (containerEl && !containerEl.contains(e.target as Node)) {
				expanded = false;
			}
		}

		document.addEventListener('click', handleClickOutside, true);
		return () => document.removeEventListener('click', handleClickOutside, true);
	});
</script>

<div class="relative" bind:this={containerEl}>
	<button
		onclick={() => (expanded = !expanded)}
		class="text-text-500 hover:text-text-300 cursor-pointer font-mono text-[10px] transition-colors"
	>
		{formattedTotal}
	</button>

	{#if expanded}
		<div
			class="border-surface-700 bg-surface-850 absolute top-full right-0 z-10 mt-1 rounded-lg border p-3 shadow-lg"
		>
			<table class="text-[10px]">
				<tbody>
					<tr>
						<td class="text-text-500 pr-4">Input tokens</td>
						<td class="text-text-300 text-right font-mono">{cost.inputTokens.toLocaleString()}</td>
					</tr>
					<tr>
						<td class="text-text-500 pr-4">Output tokens</td>
						<td class="text-text-300 text-right font-mono">{cost.outputTokens.toLocaleString()}</td>
					</tr>
					<tr>
						<td class="text-text-500 pr-4">Cache read</td>
						<td class="text-text-300 text-right font-mono"
							>{cost.cacheReadTokens.toLocaleString()}</td
						>
					</tr>
					<tr>
						<td class="text-text-500 pr-4">Cache write</td>
						<td class="text-text-300 text-right font-mono"
							>{cost.cacheWriteTokens.toLocaleString()}</td
						>
					</tr>
					<tr class="border-surface-700 border-t">
						<td class="text-text-300 pt-1 pr-4 font-semibold">Total</td>
						<td class="text-text-100 pt-1 text-right font-mono">{formattedTotal}</td>
					</tr>
				</tbody>
			</table>

			{#if hasMultipleModels}
				<div class="border-surface-700 mt-2 border-t pt-2">
					<div class="text-text-500 mb-1 text-[9px] font-semibold tracking-wider uppercase">
						Per model
					</div>
					{#each modelEntries as [model, usage] (model)}
						<div class="flex items-center justify-between gap-4 text-[10px]">
							<span class="text-text-500 font-mono">{model}</span>
							<span class="text-text-300 font-mono">
								{usage.inputTokens.toLocaleString()} in / {usage.outputTokens.toLocaleString()} out
							</span>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{/if}
</div>
