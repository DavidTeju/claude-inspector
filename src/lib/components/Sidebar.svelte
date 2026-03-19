<script lang="ts">
	import { Plus, ChevronsLeft, Settings, FolderOpen } from '@lucide/svelte';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import type { ActiveSessionSummary } from '$lib/shared/active-session-types.js';
	import { STATE_COLORS } from '$lib/shared/state-colors.js';
	import type { Project } from '$lib/types.js';
	import { dirNameToDisplayName } from '$lib/utils.js';
	import BrandMark from './BrandMark.svelte';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';

	const SIDEBAR_ID_DISPLAY_LENGTH = 6;

	let {
		projects,
		activeSessions = [],
		open,
		onToggle,
		onNewSession
	}: {
		projects: Project[];
		activeSessions?: ActiveSessionSummary[];
		open: boolean;
		onToggle: () => void;
		onNewSession: () => void;
	} = $props();

	let currentProjectId = $derived(page.params?.projectId || '');
</script>

<!--
	Tailwind dynamic class safelist (scanner needs to see these as literals):
	max-lg:translate-x-0 max-lg:-translate-x-full lg:w-64 lg:w-0 lg:overflow-hidden
-->
<aside
	class="border-sidebar-border bg-sidebar text-sidebar-foreground flex flex-col border-r
		max-lg:fixed max-lg:inset-y-0 max-lg:left-0 max-lg:z-40 max-lg:w-64
		max-lg:transition-transform max-lg:duration-250 max-lg:ease-out
		{open ? 'max-lg:translate-x-0' : 'max-lg:-translate-x-full'}
		lg:transition-all lg:duration-250
		{open ? 'lg:w-64' : 'lg:w-0 lg:overflow-hidden'}"
>
	<div class="border-sidebar-border flex items-center justify-between border-b px-4 py-2.5">
		<a href={resolve('/')} class="min-w-0">
			<BrandMark />
		</a>
		<div class="flex items-center gap-0.5">
			<Button
				variant="ghost"
				size="icon"
				class="text-sidebar-foreground hover:text-primary hover:bg-primary/10 h-7 w-7"
				onclick={onNewSession}
				aria-label="New session"
			>
				<Plus class="h-4 w-4" />
			</Button>
			<Button
				variant="ghost"
				size="icon"
				class="text-sidebar-foreground h-7 w-7"
				onclick={onToggle}
				aria-label="Close sidebar"
			>
				<ChevronsLeft class="h-[1.125rem] w-[1.125rem]" />
			</Button>
		</div>
	</div>

	<nav class="flex-1 overflow-y-auto p-2">
		{#if activeSessions.length > 0}
			<div class="border-primary/20 border-l-2 pl-1">
				<div class="mb-2 flex items-center justify-between px-2">
					<span class="text-muted-foreground text-[11px] font-semibold tracking-widest uppercase"
						>Active</span
					>
					<Badge variant="secondary" class="h-4 px-1.5 text-[9px] font-semibold">
						{activeSessions.length}
					</Badge>
				</div>
				{#each activeSessions as session (session.sessionId)}
					{@const dotColor = STATE_COLORS[session.state] ?? 'bg-muted-foreground/60'}
					<a
						href={resolve(`/session/${session.projectId}/${session.sessionId}`)}
						class="hover:bg-sidebar-accent hover:text-sidebar-accent-foreground text-sidebar-foreground/80 group flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] transition-colors"
					>
						<span
							class="h-1.5 w-1.5 flex-shrink-0 rounded-full {dotColor} {session.state === 'running'
								? 'animate-breathe'
								: ''}"
						></span>
						<span class="truncate" title={dirNameToDisplayName(session.projectId)}
							>{dirNameToDisplayName(session.projectId)}</span
						>
						<span class="text-muted-foreground ml-auto text-[10px]"
							>{session.sessionId.slice(0, SIDEBAR_ID_DISPLAY_LENGTH)}</span
						>
					</a>
				{/each}
			</div>
			<Separator class="my-2" />
		{/if}

		<div
			class="text-muted-foreground mb-2 px-2 text-[11px] font-semibold tracking-widest uppercase"
		>
			Projects
		</div>
		{#each projects as project (project.id)}
			<a
				href={resolve(`/projects/${project.id}`)}
				class="group flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] transition-colors
					{currentProjectId === project.id
					? 'bg-sidebar-accent text-primary border-primary border-l-2 font-medium'
					: 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'}"
				title={project.displayName}
			>
				<FolderOpen class="h-3.5 w-3.5 shrink-0 opacity-60" />
				<span class="truncate">{project.displayName}</span>
				<span class="text-muted-foreground ml-auto text-[10px]">{project.sessionCount}</span>
			</a>
		{/each}
	</nav>

	<Separator />
	<div class="p-2">
		<a
			href={resolve('/settings')}
			class="text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] transition-colors"
		>
			<Settings class="h-3.5 w-3.5" />
			Settings
		</a>
	</div>
</aside>
