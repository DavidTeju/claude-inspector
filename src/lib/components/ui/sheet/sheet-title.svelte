<script lang="ts">
	import { Dialog as SheetPrimitive } from 'bits-ui';
	import type { Snippet } from 'svelte';
	import { cn } from '$lib/utils.js';

	interface Props {
		class?: string;
		children?: Snippet;
		[key: string]: unknown;
	}

	let { class: className, children, ...restProps }: Props = $props();
</script>

<SheetPrimitive.Title class={cn('text-foreground text-lg font-semibold', className)} {...restProps}>
	{#if children}{@render children()}{/if}
</SheetPrimitive.Title>
