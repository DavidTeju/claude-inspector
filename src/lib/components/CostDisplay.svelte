<script lang="ts">
	import type { SessionCost } from '$lib/shared/active-session-types.js';

	const LOW_COST_THRESHOLD = 0.01;
	const LOW_COST_DECIMALS = 6;
	const HIGH_COST_DECIMALS = 3;
	const COMPACT_THRESHOLD = 1000;

	let { cost }: { cost: SessionCost } = $props();

	let expanded = $state(false);
	let containerEl: HTMLDivElement | undefined;

	let formattedTotal = $derived(
		cost.totalUsd < LOW_COST_THRESHOLD
			? `$${cost.totalUsd.toFixed(LOW_COST_DECIMALS)}`
			: `$${cost.totalUsd.toFixed(HIGH_COST_DECIMALS)}`
	);

	let totalTokens = $derived(
		cost.inputTokens + cost.outputTokens + cost.cacheReadTokens + cost.cacheWriteTokens
	);
	let formattedTokens = $derived(
		totalTokens >= COMPACT_THRESHOLD
			? `${(totalTokens / COMPACT_THRESHOLD).toFixed(1)}k`
			: `${totalTokens}`
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
		aria-label="Toggle cost breakdown"
		aria-expanded={expanded}
		class="btn btn-ghost btn-xs font-mono"
	>
		{formattedTotal} <span class="text-base-content/30">&middot;</span>
		{formattedTokens} tokens
	</button>

	{#if expanded}
		<div
			class="bg-base-200 border-base-content/10 rounded-box absolute top-full right-0 z-10 mt-1 border p-3 shadow-lg"
		>
			<table class="text-[10px]">
				<tbody>
					<tr>
						<td class="text-base-content/50 pr-4">Input tokens</td>
						<td class="text-base-content/70 text-right font-mono"
							>{cost.inputTokens.toLocaleString()}</td
						>
					</tr>
					<tr>
						<td class="text-base-content/50 pr-4">Output tokens</td>
						<td class="text-base-content/70 text-right font-mono"
							>{cost.outputTokens.toLocaleString()}</td
						>
					</tr>
					<tr>
						<td class="text-base-content/50 pr-4">Cache read</td>
						<td class="text-base-content/70 text-right font-mono"
							>{cost.cacheReadTokens.toLocaleString()}</td
						>
					</tr>
					<tr>
						<td class="text-base-content/50 pr-4">Cache write</td>
						<td class="text-base-content/70 text-right font-mono"
							>{cost.cacheWriteTokens.toLocaleString()}</td
						>
					</tr>
					<tr class="border-base-content/10 border-t">
						<td class="text-base-content pt-1 pr-4 font-semibold">Total</td>
						<td class="text-base-content pt-1 text-right font-mono font-semibold"
							>{formattedTotal}</td
						>
					</tr>
				</tbody>
			</table>

			{#if hasMultipleModels}
				<div class="border-base-content/10 mt-2 border-t pt-2">
					<div class="text-base-content/50 mb-1 text-[9px] font-semibold tracking-wider uppercase">
						Per model
					</div>
					{#each modelEntries as [model, usage] (model)}
						<div class="flex items-center justify-between gap-4 text-[10px]">
							<span class="text-base-content/50 font-mono">{model}</span>
							<span class="text-base-content/70 font-mono">
								{usage.inputTokens.toLocaleString()} in / {usage.outputTokens.toLocaleString()} out
							</span>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{/if}
</div>
