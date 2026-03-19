<script lang="ts">
	import { STAGGER_DELAY_MS } from '$lib/constants.js';
	import type { SessionEntry } from '$lib/types.js';
	import { dirNameToDisplayName, formatDate, pluralize } from '$lib/utils.js';
	import { resolve } from '$app/paths';

	const STAGGER_BASE_PX = 15;

	let { data } = $props();

	let sessions: SessionEntry[] = $derived(data.sessions);
	let sortField = $state<'modified' | 'created' | 'messageCount'>('modified');
	let sortDir = $state<'asc' | 'desc'>('desc');

	let sortedSessions = $derived.by(() => {
		return [...sessions].sort((a, b) => {
			let cmp = 0;
			if (sortField === 'modified')
				cmp = new Date(a.modified).getTime() - new Date(b.modified).getTime();
			else if (sortField === 'created')
				cmp = new Date(a.created).getTime() - new Date(b.created).getTime();
			else if (sortField === 'messageCount') cmp = a.messageCount - b.messageCount;
			return sortDir === 'desc' ? -cmp : cmp;
		});
	});

	function toggleSort(field: typeof sortField) {
		if (sortField === field) {
			sortDir = sortDir === 'desc' ? 'asc' : 'desc';
		} else {
			sortField = field;
			sortDir = 'desc';
		}
	}

	function sortIndicator(field: typeof sortField): string {
		if (sortField !== field) return '';
		return sortDir === 'desc' ? ' ↓' : ' ↑';
	}
</script>

<svelte:head>
	<title>{dirNameToDisplayName(data.projectId)} - Claude Inspector</title>
</svelte:head>

<div>
	<div class="mb-6">
		<h1 class="text-2xl font-bold tracking-tight md:text-3xl">
			{dirNameToDisplayName(data.projectId)}
		</h1>
		<p class="text-muted-foreground mt-1.5 text-sm">
			{pluralize(sessions.length, 'session')} indexed for this project.
		</p>
	</div>

	<div class="border-border overflow-x-auto rounded-xl border">
		<table class="w-full text-[0.9rem]">
			<thead>
				<tr class="border-border bg-muted text-muted-foreground border-b text-left">
					<th class="px-3 py-2.5 font-medium">Summary / First Prompt</th>
					<th class="px-3 py-2.5 font-medium whitespace-nowrap">
						<button
							onclick={() => toggleSort('messageCount')}
							class={sortField === 'messageCount' ? 'text-accent-400' : 'hover:text-text-100'}
						>
							Messages{sortIndicator('messageCount')}
						</button>
					</th>
					<th class="px-3 py-2.5 font-medium whitespace-nowrap">Branch</th>
					<th class="px-3 py-2.5 font-medium whitespace-nowrap">
						<button
							onclick={() => toggleSort('created')}
							class={sortField === 'created' ? 'text-accent-400' : 'hover:text-text-100'}
						>
							Created{sortIndicator('created')}
						</button>
					</th>
					<th class="px-3 py-2.5 font-medium whitespace-nowrap">
						<button
							onclick={() => toggleSort('modified')}
							class={sortField === 'modified' ? 'text-accent-400' : 'hover:text-text-100'}
						>
							Modified{sortIndicator('modified')}
						</button>
					</th>
				</tr>
			</thead>
			<tbody>
				{#each sortedSessions as session, i (session.sessionId)}
					<tr
						class="animate-fade-in-up border-border/50 hover:bg-card/50 border-b transition-colors"
						style="animation-delay: {Math.min(i, STAGGER_DELAY_MS) * STAGGER_BASE_PX}ms"
					>
						<td class="px-3 py-2.5">
							<a
								href={resolve(`/session/${data.projectId}/${session.sessionId}`)}
								class="hover:text-primary block transition-colors"
							>
								{#if session.summary}
									<div class="text-foreground font-medium">{session.summary}</div>
									<div class="text-foreground/80 mt-0.5 line-clamp-1 text-[0.82rem]">
										{session.firstPrompt || ''}
									</div>
								{:else if session.firstPrompt}
									<div class="text-foreground/80 line-clamp-1 font-medium italic">
										{session.firstPrompt}
									</div>
								{:else}
									<div class="text-muted-foreground italic">Empty session</div>
								{/if}
							</a>
						</td>
						<td class="text-muted-foreground px-3 py-2.5">
							{session.messageCount || '-'}
						</td>
						<td class="px-3 py-2.5">
							{#if session.gitBranch}
								<span
									class="text-primary/70 border-border/50 bg-muted rounded border px-1.5 py-0.5 font-mono text-[10px]"
								>
									{session.gitBranch}
								</span>
							{:else}
								<span class="text-muted-foreground/50">-</span>
							{/if}
						</td>
						<td class="text-muted-foreground px-3 py-2.5 whitespace-nowrap">
							{formatDate(session.created)}
						</td>
						<td class="text-muted-foreground px-3 py-2.5 whitespace-nowrap">
							{formatDate(session.modified)}
						</td>
					</tr>
				{:else}
					<tr>
						<td colspan="5" class="text-muted-foreground px-3 py-12 text-center">
							<p class="text-sm">No sessions found for this project.</p>
							<p class="mt-1 text-xs">
								Start a new Claude session in this project directory to see it here.
							</p>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>
