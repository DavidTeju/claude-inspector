<script lang="ts">
	import XIcon from '@lucide/svelte/icons/x';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';

	let {
		prefix,
		value,
		negated = false,
		onremove,
		ontogglenegation
	}: {
		prefix: string;
		value: string;
		negated?: boolean;
		onremove: () => void;
		ontogglenegation?: () => void;
	} = $props();

	let negPrefix = $derived(negated ? '-' : '');
</script>

<Badge variant={negated ? 'destructive' : 'secondary'} class="gap-1 rounded-md">
	{#if ontogglenegation}
		<Button
			variant="ghost"
			class="text-muted-foreground hover:text-foreground/80 h-auto p-0 text-xs"
			onclick={ontogglenegation}
			title={negated ? 'Switch to include' : 'Switch to exclude'}
		>
			{negPrefix}{prefix}:
		</Button>
	{:else}
		<span class="text-muted-foreground">{negPrefix}{prefix}:</span>
	{/if}
	<span>{value}</span>
	<Button
		variant="ghost"
		size="icon-xs"
		class="text-muted-foreground hover:text-foreground size-4 p-0"
		onclick={onremove}
		aria-label="Remove {negPrefix}{prefix}:{value} filter"
	>
		<XIcon class="size-3" />
	</Button>
</Badge>
