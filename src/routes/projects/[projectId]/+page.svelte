<script lang="ts">
	import { resolve } from '$app/paths';
	import { formatDate } from '$lib/utils.js';
	import type { SessionEntry } from '$lib/types.js';

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
	<title>{data.projectId} - Claude Inspector</title>
</svelte:head>

<div>
	<div class="mb-6">
		<h1 class="text-text-100 text-lg font-bold">Sessions</h1>
		<p class="text-text-500 mt-1 text-xs">{sessions.length} sessions in this project</p>
	</div>

	<div class="border-surface-800 overflow-x-auto rounded-xl border">
		<table class="w-full text-xs">
			<thead>
				<tr class="border-surface-800 bg-surface-850 text-text-500 border-b text-left">
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
						class="animate-fade-in-up border-surface-800/50 hover:bg-surface-900/50 border-b transition-colors"
						style="animation-delay: {Math.min(i, 10) * 15}ms"
					>
						<td class="px-3 py-2.5">
							<a
								href={resolve(`/session/${data.projectId}/${session.sessionId}`)}
								class="hover:text-accent-400 block transition-colors"
							>
								{#if session.summary}
									<div class="text-text-100 font-medium">{session.summary}</div>
									<div class="text-text-500 mt-0.5 line-clamp-1">
										{session.firstPrompt || ''}
									</div>
								{:else if session.firstPrompt}
									<div class="text-text-300 line-clamp-1 font-medium italic">
										{session.firstPrompt}
									</div>
								{:else}
									<div class="text-text-500 italic">Empty session</div>
								{/if}
							</a>
						</td>
						<td class="text-text-500 px-3 py-2.5">
							{session.messageCount || '-'}
						</td>
						<td class="px-3 py-2.5">
							{#if session.gitBranch}
								<span
									class="text-accent-300/70 border-surface-700/50 bg-surface-850 rounded border px-1.5 py-0.5 font-mono text-[10px]"
								>
									{session.gitBranch}
								</span>
							{:else}
								<span class="text-text-700">-</span>
							{/if}
						</td>
						<td class="text-text-500 px-3 py-2.5 whitespace-nowrap">
							{formatDate(session.created)}
						</td>
						<td class="text-text-500 px-3 py-2.5 whitespace-nowrap">
							{formatDate(session.modified)}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>
