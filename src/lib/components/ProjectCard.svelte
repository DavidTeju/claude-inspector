<script lang="ts">
	import { MessageCircle } from '@lucide/svelte';
	import type { Project } from '$lib/types.js';
	import { formatRelativeDate, pluralize } from '$lib/utils.js';
	import { resolve } from '$app/paths';

	let { project }: { project: Project } = $props();
</script>

<a
	href={resolve(`/projects/${project.id}`)}
	class="card-hover group border-surface-800/30 bg-surface-850 hover:border-surface-700/60 hover:bg-surface-800 relative block overflow-hidden rounded-lg border p-3.5 transition-all"
>
	<h3
		class="group-hover:text-accent-400 text-text-100 truncate text-base font-semibold tracking-tight transition-colors"
		title={project.displayName}
	>
		{project.displayName}
	</h3>

	<div class="text-text-500 mt-3 flex items-center gap-3 text-[11px]">
		<span class="flex items-center gap-1">
			<MessageCircle class="h-3 w-3" />
			{pluralize(project.sessionCount, 'session')}
		</span>
		<span class="text-text-700">|</span>
		<span>{formatRelativeDate(project.lastModified)}</span>
	</div>
</a>
