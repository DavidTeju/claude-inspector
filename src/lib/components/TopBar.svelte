<script lang="ts">
	import { Menu, Sun, Moon, Monitor, Search, ChevronRight } from '@lucide/svelte';
	import BrandMark from '$lib/components/BrandMark.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Tooltip, TooltipTrigger, TooltipContent } from '$lib/components/ui/tooltip/index.js';
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

<header
	class="border-border bg-background/88 flex items-center gap-4 border-b px-4 py-2.5 backdrop-blur-md lg:px-6"
>
	{#if !sidebarOpen}
		<Tooltip>
			<TooltipTrigger>
				<Button variant="ghost" size="icon" onclick={onToggleSidebar} aria-label="Open sidebar">
					<Menu class="h-5 w-5" />
				</Button>
			</TooltipTrigger>
			<TooltipContent>Open sidebar</TooltipContent>
		</Tooltip>
	{/if}

	<a href={resolve('/')} class="shrink-0">
		<BrandMark />
	</a>

	{#if breadcrumbs.length > 0}
		<div class="border-border hidden h-9 border-l sm:block"></div>
		<nav class="text-muted-foreground flex min-w-0 items-center gap-1.5 text-[0.9rem]">
			{#each breadcrumbs as crumb, i (crumb.path)}
				{#if i > 0}
					<ChevronRight class="text-muted-foreground/60 h-3.5 w-3.5" />
				{/if}
				{#if i === breadcrumbs.length - 1}
					<span class="text-foreground truncate font-medium">{crumb.label}</span>
				{:else}
					<a
						href={resolve(crumb.path)}
						class="hover:text-foreground max-w-[14rem] truncate transition-colors"
					>
						{crumb.label}
					</a>
				{/if}
			{/each}
		</nav>
	{/if}

	<div class="ml-auto flex items-center gap-1">
		<Tooltip>
			<TooltipTrigger>
				<Button
					variant="ghost"
					size="icon"
					onclick={() => theme.cycle()}
					aria-label="Theme: {theme.preference}"
				>
					{#if theme.preference === 'system'}
						<Monitor class="h-5 w-5" />
					{:else if theme.resolved === 'dark'}
						<Sun class="h-5 w-5" />
					{:else}
						<Moon class="h-5 w-5" />
					{/if}
				</Button>
			</TooltipTrigger>
			<TooltipContent>{themeLabel} mode</TooltipContent>
		</Tooltip>

		<Tooltip>
			<TooltipTrigger>
				<a
					href={resolve('/')}
					class="hover:bg-accent hover:text-accent-foreground inline-flex h-8 w-8 items-center justify-center rounded-md text-sm font-medium transition-colors"
					aria-label="Search sessions"
				>
					<Search class="h-5 w-5" />
				</a>
			</TooltipTrigger>
			<TooltipContent>Search sessions</TooltipContent>
		</Tooltip>
	</div>
</header>
