<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { dirNameToDisplayName } from '$lib/utils.js';

	let { sidebarOpen, onToggleSidebar }: { sidebarOpen: boolean; onToggleSidebar: () => void } =
		$props();

	let breadcrumbs = $derived.by(() => {
		const url = page.url?.pathname || '/';
		const parts: Array<{ label: string; href: string }> = [{ label: 'Home', href: resolve('/') }];

		if (url.startsWith('/projects/')) {
			const projectId = page.params?.projectId;
			if (projectId) {
				parts.push({
					label: dirNameToDisplayName(projectId),
					href: resolve(`/projects/${projectId}`)
				});
			}
		}

		if (url.startsWith('/session/')) {
			const projectId = page.params?.projectId;
			const sessionId = page.params?.sessionId;
			if (projectId) {
				parts.push({
					label: dirNameToDisplayName(projectId),
					href: resolve(`/projects/${projectId}`)
				});
			}
			if (sessionId) {
				parts.push({
					label: sessionId.slice(0, 8) + '...',
					href: resolve(`/session/${projectId}/${sessionId}`)
				});
			}
		}

		return parts;
	});
</script>

<header
	class="flex items-center gap-4 border-b border-zinc-800 bg-zinc-950/80 px-4 py-2.5 backdrop-blur-sm"
>
	{#if !sidebarOpen}
		<button
			onclick={onToggleSidebar}
			class="text-zinc-500 hover:text-zinc-300"
			aria-label="Open sidebar"
		>
			<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" />
			</svg>
		</button>
	{/if}

	<nav class="flex items-center gap-1 text-xs text-zinc-500">
		{#each breadcrumbs as crumb, i (i)}
			{#if i > 0}
				<span class="text-zinc-700">/</span>
			{/if}
			{#if i === breadcrumbs.length - 1}
				<span class="text-zinc-300">{crumb.label}</span>
			{:else}
				<a href={crumb.href} class="hover:text-zinc-300 transition-colors">{crumb.label}</a>
			{/if}
		{/each}
	</nav>

	<a
		href={resolve('/')}
		class="ml-auto flex items-center text-zinc-500 hover:text-zinc-300 transition-colors"
		aria-label="Search sessions"
	>
		<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
			/>
		</svg>
	</a>
</header>
