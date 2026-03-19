<script lang="ts">
	// eslint-disable-next-line import-x/no-duplicates
	import { cubicOut } from 'svelte/easing';
	// eslint-disable-next-line import-x/no-duplicates
	import { slide } from 'svelte/transition';
	import type { ToolCall } from '$lib/types.js';
	import ToolUseBlock from './ToolUseBlock.svelte';

	let { tools }: { tools: ToolCall[] } = $props();

	let expanded = $state(false);

	let errorCount = $derived(tools.filter((t) => t.result?.isError).length);

	let toolSummary = $derived.by(() => {
		const counts: Record<string, number> = {};
		for (const tool of tools) {
			counts[tool.name] = (counts[tool.name] || 0) + 1;
		}
		return Object.entries(counts).map(([name, count]) => ({ name, count }));
	});
</script>

{#if tools.length === 1}
	<ToolUseBlock tool={tools[0]} />
{:else if !expanded}
	<!-- Collapsed: subtle inline summary -->
	<button
		onclick={() => (expanded = true)}
		class="text-base-content/50 hover:text-base-content/70 border-base-content/8 hover:border-base-content/15 flex w-full flex-wrap items-center gap-x-2 gap-y-1 overflow-hidden rounded-md border border-dashed px-3 py-1.5 text-left transition-colors"
	>
		<span class="text-[11px]">{tools.length} tool calls</span>
		<span class="text-base-content/30 text-[10px]">&mdash;</span>
		{#each toolSummary as { name, count } (name)}
			<span class="font-mono text-[10px]">
				{name}{count > 1 ? ` \u00d7${count}` : ''}
			</span>
		{/each}
		{#if errorCount > 0}
			<span class="text-error ml-auto text-[10px]">
				{errorCount} error{errorCount > 1 ? 's' : ''}
			</span>
		{/if}
	</button>
{:else}
	<!-- Expanded: tool blocks + hide button at the bottom -->
	<div transition:slide={{ duration: 200, easing: cubicOut }}>
		<div class="space-y-2">
			{#each tools as tool (tool.id)}
				<ToolUseBlock {tool} />
			{/each}
		</div>
		<button
			onclick={() => (expanded = false)}
			class="text-base-content/50 hover:text-base-content/70 mt-2 w-full py-1 text-center text-[10px] transition-colors"
		>
			Hide {tools.length} tool calls
		</button>
	</div>
{/if}
