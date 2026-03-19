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
	let badgeClass = $derived(
		negated ? 'badge badge-error badge-outline' : 'badge badge-primary badge-outline'
	);
	let valueColor = $derived(negated ? 'text-error' : 'text-primary');
</script>

<span class="inline-flex items-center gap-1 px-2 py-0.5 text-xs {badgeClass}">
	{#if ontogglenegation}
		<button
			class="text-base-content/50 hover:text-base-content/70 cursor-pointer"
			onclick={ontogglenegation}
			title={negated ? 'Switch to include' : 'Switch to exclude'}
		>
			{negPrefix}{prefix}:
		</button>
	{:else}
		<span class="text-base-content/50">{negPrefix}{prefix}:</span>
	{/if}
	<span class={valueColor}>{value}</span>
	<button
		onclick={onremove}
		class="btn btn-ghost btn-xs btn-circle"
		aria-label="Remove {negPrefix}{prefix}:{value} filter"
	>
		<svg xmlns="http://www.w3.org/2000/svg" class="size-4" viewBox="0 0 16 16" fill="currentColor">
			<path
				d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708"
			/>
		</svg>
	</button>
</span>
