<script lang="ts">
	import MessageSquare from '@lucide/svelte/icons/message-square';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Card, CardHeader, CardContent } from '$lib/components/ui/card/index.js';
	import type { Project } from '$lib/types.js';
	import { formatRelativeDate, pluralize } from '$lib/utils.js';
	import { resolve } from '$app/paths';

	let { project }: { project: Project } = $props();
</script>

<a
	href={resolve(`/projects/${project.id}`)}
	class="group block transition-all hover:-translate-y-0.5"
>
	<Card class="group-hover:ring-foreground/20 h-full transition-shadow group-hover:shadow-md">
		<CardHeader class="pb-0">
			<h3
				class="text-foreground group-hover:text-primary truncate text-base font-semibold tracking-tight transition-colors"
				title={project.displayName}
			>
				{project.displayName}
			</h3>
		</CardHeader>
		<CardContent>
			<div class="text-muted-foreground flex items-center gap-3 text-[11px]">
				<Badge variant="secondary" class="gap-1 text-[11px]">
					<MessageSquare class="size-3" />
					{pluralize(project.sessionCount, 'session')}
				</Badge>
				<span>{formatRelativeDate(project.lastModified)}</span>
			</div>
		</CardContent>
	</Card>
</a>
