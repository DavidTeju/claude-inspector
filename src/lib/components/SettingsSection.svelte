<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		title,
		subtitle,
		children,
		class: className = ''
	}: {
		title: string;
		subtitle: string;
		children: Snippet;
		class?: string;
	} = $props();
</script>

<div class="border-surface-800 bg-surface-900/50 rounded-2xl border p-6 {className}">
	<h2 class="section-title">{title}</h2>
	<p class="section-subtitle">{subtitle}</p>
	{@render children()}
</div>
