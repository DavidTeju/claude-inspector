<script lang="ts">
	import type { Project } from '$lib/types.js';
	import { formatRelativeDate, pluralize } from '$lib/utils.js';
	import { resolve } from '$app/paths';

	let { project }: { project: Project } = $props();
</script>

<a
	href={resolve(`/projects/${project.id}`)}
	class="card bg-base-100 group relative block cursor-pointer overflow-hidden shadow-md transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
>
	<div class="card-body p-5">
		<h3
			class="card-title text-base-content group-hover:text-primary text-sm font-semibold tracking-tight transition-colors"
			title={project.displayName}
		>
			{project.displayName}
		</h3>

		<div class="flex items-center gap-3 text-xs opacity-60">
			<div class="badge badge-ghost badge-sm gap-1">
				<svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
					/>
				</svg>
				{pluralize(project.sessionCount, 'session')}
			</div>
			<span>{formatRelativeDate(project.lastModified)}</span>
		</div>
	</div>
</a>
