<script lang="ts">
	import Inspect from '@lucide/svelte/icons/scan-search';
	import { cn } from '$lib/utils.js';

	let { class: className, iconOnly = false }: { class?: string; iconOnly?: boolean } = $props();
</script>

<div class={cn('flex items-center gap-2.5 leading-none', className)}>
	<div
		class="bg-primary/10 text-primary ring-primary/20 relative flex h-8 w-8 items-center justify-center rounded-lg ring-1"
	>
		<Inspect class="h-4 w-4" />
	</div>

	{#if !iconOnly}
		<div class="flex min-w-0 flex-col gap-0">
			<span class="text-primary/70 text-[0.5rem] font-semibold tracking-[0.3em] uppercase"
				>Claude</span
			>
			<span class="text-foreground truncate text-sm font-extrabold tracking-wide">Inspector</span>
		</div>
	{/if}
</div>
