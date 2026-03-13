<script lang="ts">
	import { resolve } from '$app/paths';
	import type { Project } from '$lib/types.js';
	import { page } from '$app/state';

	let { projects, open, onToggle }: { projects: Project[]; open: boolean; onToggle: () => void } =
		$props();

	let currentProjectId = $derived(page.params?.projectId || '');
</script>

<aside
	class="border-surface-800 bg-surface-950 flex flex-col border-r transition-all duration-250 {open
		? 'w-64'
		: 'w-0 overflow-hidden'}"
>
	<div class="border-surface-800 flex items-center justify-between border-b p-4">
		<a href={resolve('/')} class="text-text-100 flex items-center gap-2 text-sm font-bold">
			<span class="bg-accent-500/15 text-accent-400 rounded-md px-1.5 py-0.5 text-sm font-bold"
				>CI</span
			>
			<span>Inspector</span>
		</a>
		<button onclick={onToggle} class="text-text-500 hover:text-text-100" aria-label="Close sidebar">
			<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M11 19l-7-7 7-7M18 19l-7-7 7-7" />
			</svg>
		</button>
	</div>

	<nav class="flex-1 overflow-y-auto p-2">
		<div class="text-text-500 mb-2 px-2 text-[10px] font-semibold tracking-widest uppercase">
			Projects
		</div>
		{#each projects as project (project.id)}
			<a
				href={resolve(`/projects/${project.id}`)}
				class="group flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors
					{currentProjectId === project.id
					? 'bg-accent-500/10 text-accent-400 border-accent-400 border-l-2'
					: 'text-text-300 hover:bg-surface-800/50 hover:text-text-100'}"
			>
				<span class="truncate">{project.displayName}</span>
				<span class="text-text-500 ml-auto text-[10px]">{project.sessionCount}</span>
			</a>
		{/each}
	</nav>

	<div class="border-surface-800 border-t p-2">
		<a
			href={resolve('/settings')}
			class="text-text-500 hover:bg-surface-800/50 hover:text-text-100 flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors"
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
				<path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
			</svg>
			Settings
		</a>
	</div>
</aside>
