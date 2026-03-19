<script lang="ts">
	import Check from '@lucide/svelte/icons/check';
	import Monitor from '@lucide/svelte/icons/monitor';
	import Moon from '@lucide/svelte/icons/moon';
	import Search from '@lucide/svelte/icons/search';
	import Sun from '@lucide/svelte/icons/sun';
	import { resetMode, setMode } from 'mode-watcher';
	import * as Breadcrumb from '$lib/components/ui/breadcrumb/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import { SidebarTrigger } from '$lib/components/ui/sidebar/index.js';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';
	import { SESSION_ID_DISPLAY_LENGTH } from '$lib/constants.js';
	import { theme } from '$lib/stores/theme.svelte.js';
	import { dirNameToDisplayName } from '$lib/utils.js';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';

	const themeOptions = [
		{ value: 'light' as const, label: 'Light', icon: Sun },
		{ value: 'dark' as const, label: 'Dark', icon: Moon },
		{ value: 'system' as const, label: 'System', icon: Monitor }
	];

	function getThemeIcon(preference: string) {
		if (preference === 'dark') return Moon;
		if (preference === 'light') return Sun;
		return Monitor;
	}

	let currentThemeIcon = $derived(getThemeIcon(theme.preference));

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
					label: sessionId.slice(0, SESSION_ID_DISPLAY_LENGTH) + '…',
					path: `/session/${projectId}/${sessionId}`
				});
			}
		}

		return parts;
	});

	function handleThemeSelect(value: 'light' | 'dark' | 'system') {
		if (value === 'system') {
			resetMode();
		} else {
			setMode(value);
		}
	}
</script>

<header
	class="bg-background/80 flex h-12 shrink-0 items-center gap-2 border-b px-4 backdrop-blur-md transition-[width,height] ease-linear"
>
	<SidebarTrigger class="-ml-1" />

	{#if breadcrumbs.length > 0}
		<Separator orientation="vertical" class="mr-2 !h-4" />

		<Breadcrumb.Root>
			<Breadcrumb.List>
				<Breadcrumb.Item class="hidden sm:block">
					<Breadcrumb.Link href={resolve('/')}>Home</Breadcrumb.Link>
				</Breadcrumb.Item>

				{#each breadcrumbs as crumb, i (crumb.path)}
					<Breadcrumb.Separator class="hidden sm:block" />
					<Breadcrumb.Item>
						{#if i === breadcrumbs.length - 1}
							<Breadcrumb.Page>{crumb.label}</Breadcrumb.Page>
						{:else}
							<Breadcrumb.Link href={resolve(crumb.path)}>{crumb.label}</Breadcrumb.Link>
						{/if}
					</Breadcrumb.Item>
				{/each}
			</Breadcrumb.List>
		</Breadcrumb.Root>
	{/if}

	<div class="ml-auto flex items-center gap-1">
		<Tooltip.Root>
			<Tooltip.Trigger>
				{#snippet child({ props })}
					<a href={resolve('/')} {...props}>
						<Button variant="ghost" size="icon-sm" aria-label="Search sessions">
							<Search class="h-4 w-4" />
						</Button>
					</a>
				{/snippet}
			</Tooltip.Trigger>
			<Tooltip.Content>Search sessions</Tooltip.Content>
		</Tooltip.Root>

		<DropdownMenu.Root>
			<DropdownMenu.Trigger>
				{#snippet child({ props })}
					<Button variant="ghost" size="icon-sm" aria-label="Toggle theme" {...props}>
						{@const Icon = currentThemeIcon}
						<Icon class="h-4 w-4" />
					</Button>
				{/snippet}
			</DropdownMenu.Trigger>
			<DropdownMenu.Content align="end">
				{#each themeOptions as option (option.value)}
					{@const Icon = option.icon}
					<DropdownMenu.Item onclick={() => handleThemeSelect(option.value)}>
						<Icon class="h-4 w-4" />
						{option.label}
						{#if theme.preference === option.value}
							<Check class="text-primary ml-auto h-4 w-4" />
						{/if}
					</DropdownMenu.Item>
				{/each}
			</DropdownMenu.Content>
		</DropdownMenu.Root>
	</div>
</header>
