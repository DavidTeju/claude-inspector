<script lang="ts">
  import { Select as SelectPrimitive } from 'bits-ui';
  import { cn } from '$lib/utils.js';
  import type { Snippet } from 'svelte';

  interface Props {
    class?: string;
    value: string;
    label?: string;
    disabled?: boolean;
    children?: Snippet;
    [key: string]: unknown;
  }

  let { class: className, value, label, disabled = false, children, ...restProps }: Props = $props();
</script>

<SelectPrimitive.Item
  {value}
  {label}
  {disabled}
  class={cn(
    'relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-2 pr-8 text-sm outline-none data-[disabled]:pointer-events-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-[disabled]:opacity-50',
    className
  )}
  {...restProps}
>
  {#if children}
    {@render children()}
  {:else}
    {label ?? value}
  {/if}
  <span class="absolute right-2 hidden h-3.5 w-3.5 items-center justify-center [[data-selected]>&]:flex">
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
  </span>
</SelectPrimitive.Item>
