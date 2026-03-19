<script lang="ts">
  import type { HTMLAttributes } from 'svelte/elements';
  import { cn } from '$lib/utils.js';
  import type { Snippet } from 'svelte';

  interface Props extends HTMLAttributes<HTMLTableSectionElement> {
    class?: string;
    children?: Snippet;
  }

  let { class: className, children, ...restProps }: Props = $props();
</script>

<thead class={cn('[&_tr]:border-b', className)} {...restProps}>
  {#if children}{@render children()}{/if}
</thead>
