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
		<h1 class="text-3xl font-bold">{dirNameToDisplayName(data.projectId)}</h1>
		<p class="mt-2 opacity-60">
			{pluralize(sessions.length, 'session')} indexed for this project.
		</p>
	</div>

	<div class="card bg-base-200 overflow-x-auto shadow-sm">
		<table class="table-zebra table">
			<thead>
				<tr>
					<th>Summary / First Prompt</th>
					<th class="whitespace-nowrap">
						<button
							onclick={() => toggleSort('messageCount')}
							class="link-hover {sortField === 'messageCount' ? 'text-primary font-bold' : ''}"
						>
							Messages{sortIndicator('messageCount')}
						</button>
					</th>
					<th class="whitespace-nowrap">Branch</th>
					<th class="whitespace-nowrap">
						<button
							onclick={() => toggleSort('created')}
							class="link-hover {sortField === 'created' ? 'text-primary font-bold' : ''}"
						>
							Created{sortIndicator('created')}
						</button>
					</th>
					<th class="whitespace-nowrap">
						<button
							onclick={() => toggleSort('modified')}
							class="link-hover {sortField === 'modified' ? 'text-primary font-bold' : ''}"
						>
							Modified{sortIndicator('modified')}
						</button>
					</th>
				</tr>
			</thead>
			<tbody>
				{#each sortedSessions as session, i (session.sessionId)}
					<tr
						class="animate-fade-in-up hover"
						style="animation-delay: {Math.min(i, STAGGER_DELAY_MS) * STAGGER_BASE_PX}ms"
					>
						<td>
							<a
								href={resolve(`/session/${data.projectId}/${session.sessionId}`)}
								class="link-hover block"
							>
								{#if session.summary}
									<div class="font-medium">{session.summary}</div>
									<div class="mt-0.5 line-clamp-1 text-sm opacity-60">
										{session.firstPrompt || ''}
									</div>
								{:else if session.firstPrompt}
									<div class="line-clamp-1 font-medium italic opacity-70">
										{session.firstPrompt}
									</div>
								{:else}
									<div class="italic opacity-40">Empty session</div>
								{/if}
							</a>
						</td>
						<td class="opacity-60">
							{session.messageCount || '-'}
						</td>
						<td>
							{#if session.gitBranch}
								<span class="badge badge-primary badge-sm badge-outline font-mono text-[10px]">
									{session.gitBranch}
								</span>
							{:else}
								<span class="opacity-30">-</span>
							{/if}
						</td>
						<td class="whitespace-nowrap opacity-60">
							{formatDate(session.created)}
						</td>
						<td class="whitespace-nowrap opacity-60">
							{formatDate(session.modified)}
						</td>
					</tr>
				{:else}
					<tr>
						<td colspan="5" class="py-12 text-center opacity-50">
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
