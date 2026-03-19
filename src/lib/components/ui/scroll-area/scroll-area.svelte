<script lang="ts">
	import { ScrollArea as ScrollAreaPrimitive } from 'bits-ui';
	import type { Snippet } from 'svelte';
	import { cn } from '$lib/utils.js';

	interface Props {
		class?: string;
		orientation?: 'vertical' | 'horizontal' | 'both';
		children?: Snippet;
		[key: string]: unknown;
	}

	let { class: className, orientation = 'vertical', children, ...restProps }: Props = $props();
</script>

<ScrollAreaPrimitive.Root class={cn('relative overflow-hidden', className)} {...restProps}>
	<ScrollAreaPrimitive.Viewport class="h-full w-full rounded-[inherit]">
		{#if children}{@render children()}{/if}
	</ScrollAreaPrimitive.Viewport>
	<ScrollAreaPrimitive.Scrollbar
		orientation={orientation === 'both' ? 'vertical' : orientation}
		class={cn(
			'flex touch-none transition-colors select-none',
			orientation === 'horizontal'
				? 'h-2.5 flex-col border-t border-t-transparent p-[1px]'
				: 'h-full w-2.5 border-l border-l-transparent p-[1px]'
		)}
	>
		<ScrollAreaPrimitive.Thumb class="bg-border relative flex-1 rounded-full" />
	</ScrollAreaPrimitive.Scrollbar>
	{#if orientation === 'both'}
		<ScrollAreaPrimitive.Scrollbar
			orientation="horizontal"
			class="flex h-2.5 touch-none flex-col border-t border-t-transparent p-[1px] transition-colors select-none"
		>
			<ScrollAreaPrimitive.Thumb class="bg-border relative flex-1 rounded-full" />
		</ScrollAreaPrimitive.Scrollbar>
	{/if}
</ScrollAreaPrimitive.Root>
