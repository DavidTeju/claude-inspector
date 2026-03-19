<script lang="ts">
	import { Dialog as DialogPrimitive } from 'bits-ui';
	import type { Snippet } from 'svelte';
	import { cn } from '$lib/utils.js';

	interface Props {
		class?: string;
		children?: Snippet;
		[key: string]: unknown;
	}

	let { class: className, children, ...restProps }: Props = $props();
</script>

<DialogPrimitive.Description class={cn('text-muted-foreground text-sm', className)} {...restProps}>
	{#if children}{@render children()}{/if}
</DialogPrimitive.Description>
