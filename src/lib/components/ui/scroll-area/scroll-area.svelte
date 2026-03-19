<script lang="ts">
  import { ScrollArea as ScrollAreaPrimitive } from 'bits-ui';
  import { cn } from '$lib/utils.js';
  import type { Snippet } from 'svelte';

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
    class="flex touch-none select-none transition-colors {orientation === 'horizontal' ? 'h-2.5 flex-col border-t border-t-transparent p-[1px]' : 'h-full w-2.5 border-l border-l-transparent p-[1px]'}"
  >
    <ScrollAreaPrimitive.Thumb class="relative flex-1 rounded-full bg-border" />
  </ScrollAreaPrimitive.Scrollbar>
  {#if orientation === 'both'}
    <ScrollAreaPrimitive.Scrollbar
      orientation="horizontal"
      class="flex touch-none select-none transition-colors h-2.5 flex-col border-t border-t-transparent p-[1px]"
    >
      <ScrollAreaPrimitive.Thumb class="relative flex-1 rounded-full bg-border" />
    </ScrollAreaPrimitive.Scrollbar>
  {/if}
</ScrollAreaPrimitive.Root>
