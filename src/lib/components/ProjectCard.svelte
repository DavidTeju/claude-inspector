<script lang="ts">
	import { resolve } from '$app/paths';
	import type { Project } from '$lib/types.js';
	import { formatRelativeDate } from '$lib/utils.js';

	let { project }: { project: Project } = $props();
</script>

<a
	href={resolve(`/projects/${project.id}`)}
	class="card-hover group border-surface-800/30 bg-surface-850 hover:border-surface-700/60 hover:bg-surface-800 relative block overflow-hidden rounded-lg border p-3.5 transition-all"
>
	<h3
		class="group-hover:text-accent-400 text-text-100 truncate text-sm font-semibold transition-colors"
		title={project.displayName}
	>
		{project.displayName}
	</h3>

	<div class="text-text-500 mt-3 flex items-center gap-3 text-[11px]">
		<span class="flex items-center gap-1">
			<svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
				/>
			</svg>
			{project.sessionCount} sessions
		</span>
		<span class="text-text-700">|</span>
		<span>{formatRelativeDate(project.lastModified)}</span>
	</div>
</a>
