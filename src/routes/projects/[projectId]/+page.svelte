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
		<h1 class="text-lg font-bold text-zinc-100">Sessions</h1>
		<p class="mt-1 text-xs text-zinc-500">{sessions.length} sessions in this project</p>
	</div>

	<div class="overflow-x-auto rounded-lg border border-zinc-800">
		<table class="w-full text-xs">
			<thead>
				<tr class="border-b border-zinc-800 bg-zinc-900/50 text-left text-zinc-500">
					<th class="px-3 py-2.5 font-medium">Summary / First Prompt</th>
					<th class="px-3 py-2.5 font-medium whitespace-nowrap">
						<button onclick={() => toggleSort('messageCount')} class="hover:text-zinc-300">
							Messages{sortIndicator('messageCount')}
						</button>
					</th>
					<th class="px-3 py-2.5 font-medium whitespace-nowrap">Branch</th>
					<th class="px-3 py-2.5 font-medium whitespace-nowrap">
						<button onclick={() => toggleSort('created')} class="hover:text-zinc-300">
							Created{sortIndicator('created')}
						</button>
					</th>
					<th class="px-3 py-2.5 font-medium whitespace-nowrap">
						<button onclick={() => toggleSort('modified')} class="hover:text-zinc-300">
							Modified{sortIndicator('modified')}
						</button>
					</th>
				</tr>
			</thead>
			<tbody>
				{#each sortedSessions as session (session.sessionId)}
					<tr class="border-b border-zinc-800/50 transition-colors hover:bg-zinc-900/50">
						<td class="px-3 py-2.5">
							<a
								href={resolve(`/session/${data.projectId}/${session.sessionId}`)}
								class="block hover:text-accent-400 transition-colors"
							>
								{#if session.summary}
									<div class="font-medium text-zinc-200">{session.summary}</div>
									<div class="mt-0.5 text-zinc-500 line-clamp-1">
										{session.firstPrompt || ''}
									</div>
								{:else if session.firstPrompt}
									<div class="font-medium text-zinc-400 italic line-clamp-1">
										{session.firstPrompt}
									</div>
								{:else}
									<div class="text-zinc-600 italic">Empty session</div>
								{/if}
							</a>
						</td>
						<td class="px-3 py-2.5 text-zinc-500">
							{session.messageCount || '-'}
						</td>
						<td class="px-3 py-2.5">
							{#if session.gitBranch}
								<span class="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400">
									{session.gitBranch}
								</span>
							{:else}
								<span class="text-zinc-700">-</span>
							{/if}
						</td>
						<td class="px-3 py-2.5 text-zinc-500 whitespace-nowrap">
							{formatDate(session.created)}
						</td>
						<td class="px-3 py-2.5 text-zinc-500 whitespace-nowrap">
							{formatDate(session.modified)}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>
