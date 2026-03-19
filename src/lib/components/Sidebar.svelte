<script lang="ts">
	import FolderOpen from '@lucide/svelte/icons/folder-open';
	import Plus from '@lucide/svelte/icons/plus';
	import Settings from '@lucide/svelte/icons/settings';
	import Zap from '@lucide/svelte/icons/zap';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import type { ActiveSessionSummary } from '$lib/shared/active-session-types.js';
	import { STATE_COLORS } from '$lib/shared/state-colors.js';
	import type { Project } from '$lib/types.js';
	import { cn, dirNameToDisplayName } from '$lib/utils.js';
	import BrandMark from './BrandMark.svelte';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';

	const SIDEBAR_ID_DISPLAY_LENGTH = 6;

	let {
		projects,
		activeSessions = [],
		onNewSession
	}: {
		projects: Project[];
		activeSessions?: ActiveSessionSummary[];
		onNewSession: () => void;
	} = $props();

	let currentProjectId = $derived(page.params?.projectId || '');
</script>

<Sidebar.Header class="p-3">
	<div class="flex items-center justify-between">
		<a href={resolve('/')} class="min-w-0">
			<BrandMark />
		</a>
		<button
			onclick={onNewSession}
			class="text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors"
			aria-label="New session"
		>
			<Plus class="h-4 w-4" />
		</button>
	</div>
</Sidebar.Header>

<Sidebar.Content>
	{#if activeSessions.length > 0}
		<Sidebar.Group>
			<Sidebar.GroupLabel
				class="flex items-center gap-2 text-xs font-semibold tracking-wider uppercase"
			>
				<Zap class="text-primary h-3 w-3" />
				Active
				<Badge variant="secondary" class="ml-auto h-4 min-w-4 px-1 text-[10px]">
					{activeSessions.length}
				</Badge>
			</Sidebar.GroupLabel>
			<Sidebar.GroupContent>
				<Sidebar.Menu>
					{#each activeSessions as session (session.sessionId)}
						{@const dotColor = STATE_COLORS[session.state] ?? 'bg-text-700'}
						<Sidebar.MenuItem>
							<Sidebar.MenuButton
								isActive={page.params?.sessionId === session.sessionId}
								tooltipContent={dirNameToDisplayName(session.projectId)}
							>
								{#snippet child({ props })}
									<a
										href={resolve(`/session/${session.projectId}/${session.sessionId}`)}
										{...props}
									>
										<span
											class={cn(
												'h-1.5 w-1.5 flex-shrink-0 rounded-full',
												dotColor,
												session.state === 'running' && 'animate-breathe'
											)}
										></span>
										<span class="truncate">{dirNameToDisplayName(session.projectId)}</span>
										<span class="text-muted-foreground ml-auto text-[10px]">
											{session.sessionId.slice(0, SIDEBAR_ID_DISPLAY_LENGTH)}
										</span>
									</a>
								{/snippet}
							</Sidebar.MenuButton>
						</Sidebar.MenuItem>
					{/each}
				</Sidebar.Menu>
			</Sidebar.GroupContent>
		</Sidebar.Group>

		<Separator class="mx-3" />
	{/if}

	<Sidebar.Group>
		<Sidebar.GroupLabel
			class="flex items-center gap-2 text-xs font-semibold tracking-wider uppercase"
		>
			<FolderOpen class="h-3 w-3" />
			Projects
		</Sidebar.GroupLabel>
		<Sidebar.GroupContent>
			<Sidebar.Menu>
				{#each projects as project (project.id)}
					<Sidebar.MenuItem>
						<Sidebar.MenuButton
							isActive={currentProjectId === project.id}
							tooltipContent={project.displayName}
						>
							{#snippet child({ props })}
								<a href={resolve(`/projects/${project.id}`)} {...props} title={project.displayName}>
									<span class="truncate">{project.displayName}</span>
								</a>
							{/snippet}
						</Sidebar.MenuButton>
						<Sidebar.MenuBadge>
							{project.sessionCount}
						</Sidebar.MenuBadge>
					</Sidebar.MenuItem>
				{/each}
			</Sidebar.Menu>
		</Sidebar.GroupContent>
	</Sidebar.Group>
</Sidebar.Content>

<Sidebar.Footer class="p-2">
	<Sidebar.Menu>
		<Sidebar.MenuItem>
			<Sidebar.MenuButton tooltipContent="Settings">
				{#snippet child({ props })}
					<a href={resolve('/settings')} {...props}>
						<Settings class="h-4 w-4" />
						<span>Settings</span>
					</a>
				{/snippet}
			</Sidebar.MenuButton>
		</Sidebar.MenuItem>
	</Sidebar.Menu>
</Sidebar.Footer>
