<script lang="ts">
	import type { Project } from '$lib/types.js';
	import { formatRelativeDate, pluralize } from '$lib/utils.js';
	import { resolve } from '$app/paths';

	let { project }: { project: Project } = $props();
</script>

<a
	href={resolve(`/projects/${project.id}`)}
	class="card group bg-base-300 hover:bg-neutral border-base-content/5 hover:border-base-content/10 relative block overflow-hidden border p-3.5 transition-all hover:-translate-y-0.5 hover:shadow-md"
>
	<h3
		class="text-base-content group-hover:text-primary truncate text-base font-semibold tracking-tight transition-colors"
		title={project.displayName}
	>
		{project.displayName}
	</h3>

	<div class="text-base-content/50 mt-3 flex items-center gap-3 text-[11px]">
		<span class="flex items-center gap-1">
			<svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
				/>
			</svg>
			{pluralize(project.sessionCount, 'session')}
		</span>
		<span class="text-base-content/30">|</span>
		<span>{formatRelativeDate(project.lastModified)}</span>
	</div>
</a>
