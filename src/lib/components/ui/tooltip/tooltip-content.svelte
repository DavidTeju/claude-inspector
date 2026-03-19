<script lang="ts">
  import { Tooltip as TooltipPrimitive } from 'bits-ui';
  import { cn } from '$lib/utils.js';
  import type { Snippet } from 'svelte';

  interface Props {
    class?: string;
    sideOffset?: number;
    children?: Snippet;
    [key: string]: unknown;
  }

  let { class: className, sideOffset = 4, children, ...restProps }: Props = $props();
</script>

<TooltipPrimitive.Portal>
  <TooltipPrimitive.Content
    {sideOffset}
    class={cn(
      'z-50 overflow-hidden rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground animate-in fade-in-0 zoom-in-95',
      className
    )}
    {...restProps}
  >
    {#if children}{@render children()}{/if}
  </TooltipPrimitive.Content>
</TooltipPrimitive.Portal>
