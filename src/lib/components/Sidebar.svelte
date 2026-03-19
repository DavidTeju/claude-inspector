<script lang="ts">
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
	class="bg-base-100 flex flex-col shadow-lg
max-lg:fixed max-lg:inset-y-0 max-lg:left-0 max-lg:z-40 max-lg:w-64
max-lg:transition-transform max-lg:duration-250 max-lg:ease-out
{open ? 'max-lg:translate-x-0' : 'max-lg:-translate-x-full'}
lg:transition-all lg:duration-250
{open ? 'lg:w-64' : 'lg:w-0 lg:overflow-hidden'}"
>
	<div class="flex items-center justify-between px-4 py-3.5">
		<a href={resolve('/')} class="min-w-0">
			<BrandMark />
		</a>
		<div class="flex items-center gap-1">
			<button
				onclick={onNewSession}
				class="btn btn-ghost btn-circle btn-sm hover:text-primary"
				aria-label="New session"
			>
				<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
				</svg>
			</button>
			<button onclick={onToggle} class="btn btn-ghost btn-circle btn-sm" aria-label="Close sidebar">
				<svg
					class="h-[1.125rem] w-[1.125rem]"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="2"
				>
					<path stroke-linecap="round" stroke-linejoin="round" d="M11 19l-7-7 7-7M18 19l-7-7 7-7" />
				</svg>
			</button>
		</div>
	</div>

	<div class="divider my-0 px-3"></div>

	<nav class="flex-1 overflow-y-auto p-2">
		{#if activeSessions.length > 0}
			<ul class="menu menu-sm p-0">
				<li>
					<h2 class="menu-title flex items-center justify-between">
						<span>Active</span>
						<span class="badge badge-primary badge-xs font-semibold">{activeSessions.length}</span>
					</h2>
					<ul class="border-primary/20 border-l-2">
						{#each activeSessions as session (session.sessionId)}
							{@const dotColor = STATE_COLORS[session.state] ?? 'bg-base-content/30'}
							<li>
								<a
									href={resolve(`/session/${session.projectId}/${session.sessionId}`)}
									class="text-[13px]"
								>
									<span
										class="h-1.5 w-1.5 flex-shrink-0 rounded-full {dotColor} {session.state ===
										'running'
											? 'animate-breathe'
											: ''}"
									></span>
									<span class="truncate" title={dirNameToDisplayName(session.projectId)}
										>{dirNameToDisplayName(session.projectId)}</span
									>
									<span class="text-base-content/50 ml-auto text-[10px]"
										>{session.sessionId.slice(0, SIDEBAR_ID_DISPLAY_LENGTH)}</span
									>
								</a>
							</li>
						{/each}
					</ul>
				</li>
			</ul>
			<div class="divider my-1"></div>
		{/if}

		<ul class="menu menu-sm p-0">
			<li>
				<h2 class="menu-title">Projects</h2>
				<ul>
					{#each projects as project (project.id)}
						<li>
							<a
								href={resolve(`/projects/${project.id}`)}
								class="text-[13px] {currentProjectId === project.id ? 'active font-medium' : ''}"
								aria-current={currentProjectId === project.id ? 'page' : undefined}
								title={project.displayName}
							>
								<span class="truncate">{project.displayName}</span>
								<span class="text-base-content/50 ml-auto text-[10px]">{project.sessionCount}</span>
							</a>
						</li>
					{/each}
				</ul>
			</li>
		</ul>
	</nav>

	<div class="divider my-0 px-3"></div>
	<div class="p-2">
		<ul class="menu menu-sm p-0">
			<li>
				<a
					href={resolve('/settings')}
					class="text-base-content/50 hover:text-base-content text-[13px]"
				>
					<svg
						class="h-3.5 w-3.5"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="2"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
						/>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
						/>
					</svg>
					Settings
				</a>
			</li>
		</ul>
	</div>
</aside>
