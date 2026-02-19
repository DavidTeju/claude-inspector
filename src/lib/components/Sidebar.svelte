<script lang="ts">
	import type { Project } from '$lib/types.js';
	import { page } from '$app/state';

	let { projects, open, onToggle }: { projects: Project[]; open: boolean; onToggle: () => void } =
		$props();

	let currentProjectId = $derived(page.params?.projectId || '');
</script>

<aside
	class="flex flex-col border-r border-zinc-800 bg-zinc-950 transition-all duration-200 {open
		? 'w-64'
		: 'w-0 overflow-hidden'}"
>
	<div class="flex items-center justify-between border-b border-zinc-800 p-4">
		<a href="/" class="flex items-center gap-2 text-sm font-bold text-zinc-100">
			<span class="text-accent-400 text-lg">CI</span>
			<span>Inspector</span>
		</a>
		<button onclick={onToggle} class="text-zinc-500 hover:text-zinc-300" aria-label="Close sidebar">
			<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M11 19l-7-7 7-7M18 19l-7-7 7-7" />
			</svg>
		</button>
	</div>

	<nav class="flex-1 overflow-y-auto p-2">
		<div class="mb-2 px-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
			Projects
		</div>
		{#each projects as project (project.id)}
			<a
				href="/projects/{project.id}"
				class="group flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors
					{currentProjectId === project.id
					? 'bg-accent-500/10 text-accent-400'
					: 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'}"
			>
				<span class="truncate">{project.displayName}</span>
				<span class="ml-auto text-[10px] text-zinc-600">{project.sessionCount}</span>
			</a>
		{/each}
	</nav>
</aside>
