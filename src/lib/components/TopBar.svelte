<script lang="ts">
	import BrandMark from '$lib/components/BrandMark.svelte';
	import { SESSION_ID_DISPLAY_LENGTH } from '$lib/constants.js';
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

<div class="navbar border-base-300 bg-base-100 border-b px-4 lg:px-6">
	<div class="navbar-start gap-2">
		{#if !sidebarOpen}
			<button
				onclick={onToggleSidebar}
				class="btn btn-ghost btn-square btn-sm"
				aria-label="Open sidebar"
			>
				<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" />
				</svg>
			</button>
		{/if}

		<a href={resolve('/')} class="shrink-0">
			<BrandMark />
		</a>

		{#if breadcrumbs.length > 0}
			<div class="divider divider-horizontal mx-0 hidden sm:block"></div>
			<div class="breadcrumbs hidden text-sm sm:flex">
				<ul>
					{#each breadcrumbs as crumb, i (crumb.path)}
						<li>
							{#if i === breadcrumbs.length - 1}
								<span class="font-medium">{crumb.label}</span>
							{:else}
								<a href={resolve(crumb.path)} class="link-hover opacity-60">{crumb.label}</a>
							{/if}
						</li>
					{/each}
				</ul>
			</div>
		{/if}
	</div>

	<div class="navbar-end gap-1">
		<div class="tooltip tooltip-bottom" data-tip={themeLabel + ' mode'}>
			<button
				onclick={() => theme.cycle()}
				class="btn btn-ghost btn-circle btn-sm"
				aria-label="Theme: {theme.preference}"
			>
				{#if theme.preference === 'system'}
					<svg
						class="h-5 w-5"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="2"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
						/>
					</svg>
				{:else if theme.resolved === 'dark'}
					<svg
						class="h-5 w-5"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="2"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
						/>
					</svg>
				{:else}
					<svg
						class="h-5 w-5"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="2"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
						/>
					</svg>
				{/if}
			</button>
		</div>

		<a href={resolve('/')} class="btn btn-ghost btn-circle btn-sm" aria-label="Search sessions">
			<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
				/>
			</svg>
		</a>
	</div>
</div>
