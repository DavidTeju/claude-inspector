<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		id,
		label,
		children
	}: {
		id: string;
		label: string;
		children: Snippet;
	} = $props();
</script>

<div>
	<label for={id} class="text-text-300 mb-1.5 block text-xs font-medium">{label}</label>
	{@render children()}
</div>
