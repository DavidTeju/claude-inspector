<script lang="ts">
	let {
		prefix,
		value,
		negated = false,
		onremove,
		ontogglenegation
	}: {
		prefix: string;
		value: string;
		negated?: boolean;
		onremove: () => void;
		ontogglenegation?: () => void;
	} = $props();

	let negPrefix = $derived(negated ? '-' : '');
	let borderColor = $derived(
		negated ? 'border-red-500/30 bg-red-500/10' : 'border-accent-500/50 bg-accent-500/10'
	);
	let valueColor = $derived(negated ? 'text-red-400' : 'text-accent-300');
</script>

<span class="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs {borderColor}">
	{#if ontogglenegation}
		<button
			class="text-text-500 hover:text-text-300 cursor-pointer"
			onclick={ontogglenegation}
			title={negated ? 'Switch to include' : 'Switch to exclude'}
		>
			{negPrefix}{prefix}:
		</button>
	{:else}
		<span class="text-text-500">{negPrefix}{prefix}:</span>
	{/if}
	<span class={valueColor}>{value}</span>
	<button
		onclick={onremove}
		class="text-text-500 hover:text-text-100 transition-colors"
		aria-label="Remove {negPrefix}{prefix}:{value} filter"
	>
		<svg xmlns="http://www.w3.org/2000/svg" class="size-4" viewBox="0 0 16 16" fill="currentColor">
			<path
				d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708"
			/>
		</svg>
	</button>
</span>
