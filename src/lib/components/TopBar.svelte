<script lang="ts">
	import { Menu, Monitor, Moon, Search, Sun } from '@lucide/svelte';
	import BrandMark from '$lib/components/BrandMark.svelte';
	import { SESSION_ID_DISPLAY_LENGTH } from '$lib/constants.js';
	import { searchOverlay } from '$lib/stores/search-overlay.svelte.js';
	import { theme } from '$lib/stores/theme.svelte.js';
	import { dirNameToDisplayName } from '$lib/utils.js';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';

	let { sidebarOpen, onToggleSidebar }: { sidebarOpen: boolean; onToggleSidebar: () => void } =
		$props();

	const prefLabels: Record<string, string> = { system: 'System', light: 'Light', dark: 'Dark' };
	let themeLabel = $derived(prefLabels[theme.preference] ?? 'System');

	type BreadcrumbPath = '/' | `/projects/${string}` | `/session/${string}/${string}`;

	let breadcrumbs = $derived.by(() => {
		const url = page.url?.pathname || '/';
		const parts: Array<{ label: string; path: BreadcrumbPath }> = [];

		if (url.startsWith('/projects/')) {
			const projectId = page.params?.projectId;
			if (projectId) {
				parts.push({
					label: dirNameToDisplayName(projectId),
					path: `/projects/${projectId}`
				});
			}
		} else if (url.startsWith('/session/')) {
			const projectId = page.params?.projectId;
			const sessionId = page.params?.sessionId;
			if (projectId) {
				parts.push({
					label: dirNameToDisplayName(projectId),
					path: `/projects/${projectId}`
				});
			}
			if (sessionId) {
				parts.push({
					label: sessionId.slice(0, SESSION_ID_DISPLAY_LENGTH) + '...',
					path: `/session/${projectId}/${sessionId}`
				});
			}
		}

		return parts;
	});
</script>

<header
	class="border-surface-800 bg-surface-950/88 flex items-center gap-4 border-b px-4 py-2.5 backdrop-blur-md lg:px-6"
>
	{#if !sidebarOpen}
		<button onclick={onToggleSidebar} class="btn-icon-lg" aria-label="Open sidebar">
			<Menu class="h-5 w-5" />
		</button>
	{/if}

	<a href={resolve('/')} class="shrink-0">
		<BrandMark />
	</a>

	{#if breadcrumbs.length > 0}
		<div class="border-surface-800 hidden h-9 border-l sm:block"></div>
		<nav class="text-text-500 flex min-w-0 items-center gap-2 text-[0.9rem]">
			{#each breadcrumbs as crumb, i (crumb.path)}
				{#if i > 0}
					<span class="text-text-700">/</span>
				{/if}
				{#if i === breadcrumbs.length - 1}
					<span class="text-text-100 truncate font-medium">{crumb.label}</span>
				{:else}
					<a
						href={resolve(crumb.path)}
						class="hover:text-text-100 max-w-[14rem] truncate transition-colors"
					>
						{crumb.label}
					</a>
				{/if}
			{/each}
		</nav>
	{/if}

	<div class="ml-auto flex items-center gap-3">
		<button
			onclick={() => theme.cycle()}
			class="btn-icon-lg"
			aria-label="Theme: {theme.preference}"
			title={themeLabel + ' mode'}
		>
			{#if theme.preference === 'system'}
				<Monitor class="h-5 w-5" />
			{:else if theme.resolved === 'dark'}
				<Sun class="h-5 w-5" />
			{:else}
				<Moon class="h-5 w-5" />
			{/if}
		</button>

		<button onclick={() => searchOverlay.show()} class="btn-icon-lg" aria-label="Search sessions">
			<Search class="h-5 w-5" />
		</button>
	</div>
</header>
