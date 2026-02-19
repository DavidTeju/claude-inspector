<script lang="ts">
	import { resolve } from '$app/paths';
	import type { Project } from '$lib/types.js';

	let { project }: { project: Project } = $props();

	function formatDate(iso: string): string {
		if (!iso) return 'Unknown';
		const d = new Date(iso);
		const now = new Date();
		const diffMs = now.getTime() - d.getTime();
		const diffMins = Math.floor(diffMs / 60000);
		const diffHours = Math.floor(diffMs / 3600000);
		const diffDays = Math.floor(diffMs / 86400000);

		if (diffMins < 1) return 'Just now';
		if (diffMins < 60) return `${diffMins}m ago`;
		if (diffHours < 24) return `${diffHours}h ago`;
		if (diffDays < 7) return `${diffDays}d ago`;
		return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
	}
</script>

<a
	href={resolve(`/projects/${project.id}`)}
	class="group rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 transition-all hover:border-zinc-700 hover:bg-zinc-900"
>
	<div class="flex items-start justify-between">
		<h3 class="text-sm font-semibold text-zinc-200 group-hover:text-accent-400 transition-colors">
			{project.displayName}
		</h3>
	</div>

	<div class="mt-3 flex items-center gap-3 text-[11px] text-zinc-500">
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
		<span class="text-zinc-700">|</span>
		<span>{formatDate(project.lastModified)}</span>
	</div>
</a>
