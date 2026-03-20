<script lang="ts">
	import type { RecentSession } from '$lib/types.js';
	import { formatRelativeDate } from '$lib/utils.js';
	import { resolve } from '$app/paths';

	let { session }: { session: RecentSession } = $props();

	let title = $derived(
		session.customTitle || session.nativeSummary || session.summary || 'Untitled'
	);
</script>

<a
	href={resolve(`/session/${session.projectId}/${session.sessionId}`)}
	class="card-hover border-surface-800 bg-surface-900/50 hover:border-surface-700 hover:bg-surface-900 flex flex-col gap-1 rounded-lg border px-3 py-2 transition-all"
>
	<div class="flex items-center gap-3">
		<div class="min-w-0 flex-1">
			<span class="text-text-100 block truncate text-sm font-medium">{title}</span>
		</div>
		<div class="flex shrink-0 items-center gap-2 text-[10px]">
			<span class="text-accent-400/60 tracking-wider uppercase">{session.projectDisplayName}</span>
			<span class="text-text-500">{formatRelativeDate(session.modified)}</span>
		</div>
	</div>
	{#if session.firstPrompt}
		<span class="text-text-500 block truncate text-xs">{session.firstPrompt}</span>
	{/if}
</a>
