<script lang="ts">
	import { slide } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import ToolUseBlock from './ToolUseBlock.svelte';
	import type { ToolCall } from '$lib/types.js';

	let { tools }: { tools: ToolCall[] } = $props();

	let expanded = $state(false);

	let errorCount = $derived(tools.filter((t) => t.isError).length);

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
		class="text-text-500 hover:text-text-300 border-surface-800/60 hover:border-surface-700 flex w-full items-center gap-2 rounded-md border border-dashed px-3 py-1.5 text-left transition-colors"
	>
		<span class="text-[11px]">{tools.length} tool calls</span>
		<span class="text-text-700 text-[10px]">&mdash;</span>
		{#each toolSummary as { name, count } (name)}
			<span class="font-mono text-[10px]">
				{name}{count > 1 ? ` \u00d7${count}` : ''}
			</span>
		{/each}
		{#if errorCount > 0}
			<span class="text-error-400 ml-auto text-[10px]">
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
			class="text-text-500 hover:text-text-300 mt-2 w-full py-1 text-center text-[10px] transition-colors"
		>
			Hide {tools.length} tool calls
		</button>
	</div>
{/if}
