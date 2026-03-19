<script lang="ts">
	import { Separator as SeparatorPrimitive } from 'bits-ui';
	import { cn } from '$lib/utils.js';

	interface Props {
		class?: string;
		orientation?: 'horizontal' | 'vertical';
		decorative?: boolean;
	}

	let {
		class: className,
		orientation = 'horizontal',
		decorative = true,
		...restProps
	}: Props = $props();
</script>

<SeparatorPrimitive.Root
	{orientation}
	{decorative}
	class={cn(
		'bg-border shrink-0',
		orientation === 'horizontal' ? 'h-[1px] w-full' : 'h-full w-[1px]',
		className
	)}
	{...restProps}
/>
