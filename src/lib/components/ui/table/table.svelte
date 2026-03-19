<script lang="ts">
  import type { HTMLTableAttributes } from 'svelte/elements';
  import { cn } from '$lib/utils.js';
  import type { Snippet } from 'svelte';

  interface Props extends HTMLTableAttributes {
    class?: string;
    children?: Snippet;
  }

  let { class: className, children, ...restProps }: Props = $props();
</script>

<div class="relative w-full overflow-auto">
  <table class={cn('w-full caption-bottom text-sm', className)} {...restProps}>
    {#if children}{@render children()}{/if}
  </table>
</div>
