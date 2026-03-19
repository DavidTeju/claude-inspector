<script lang="ts" module>
	import { tv, type VariantProps } from 'tailwind-variants';

	export const buttonVariants = tv({
		base: 'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0',
		variants: {
			variant: {
				default: 'bg-primary text-primary-foreground shadow-sm hover:bg-primary/90',
				destructive: 'bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90',
				outline:
					'border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground',
				secondary: 'bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80',
				ghost: 'hover:bg-accent hover:text-accent-foreground',
				link: 'text-primary underline-offset-4 hover:underline'
			},
			size: {
				default: 'h-8 px-3 py-1.5',
				sm: 'h-7 rounded-md px-2.5 text-xs',
				lg: 'h-9 rounded-md px-4',
				icon: 'h-8 w-8'
			}
		},
		defaultVariants: {
			variant: 'default',
			size: 'default'
		}
	});

	type Variant = VariantProps<typeof buttonVariants>['variant'];
	type Size = VariantProps<typeof buttonVariants>['size'];
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';
	import { cn } from '$lib/utils.js';

	interface Props extends HTMLButtonAttributes {
		variant?: Variant;
		size?: Size;
		class?: string;
		children?: Snippet;
	}

	let {
		variant = 'default',
		size = 'default',
		class: className,
		children,
		...restProps
	}: Props = $props();
</script>

<button class={cn(buttonVariants({ variant, size }), className)} {...restProps}>
	{#if children}{@render children()}{/if}
</button>
