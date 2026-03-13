<script lang="ts">
	import { resolve } from '$app/paths';
	import MessageThread from '$lib/components/MessageThread.svelte';

	let { data } = $props();
</script>

<svelte:head>
	<title
		>{data.summary || data.firstPrompt || 'Session ' + data.sessionId.slice(0, 8)} - Claude Inspector</title
	>
</svelte:head>

<div class="mx-auto max-w-4xl">
	<!-- Session header -->
	<div
		class="border-surface-800 bg-surface-900/50 mb-6 flex items-center gap-4 rounded-lg border p-4"
	>
		<div class="flex-1">
			{#if data.summary}
				<h1 class="text-text-100 text-sm font-bold">{data.summary}</h1>
				{#if data.firstPrompt}
					<p class="text-text-500 mt-1 line-clamp-1 text-xs">{data.firstPrompt}</p>
				{/if}
				<p class="text-text-500 mt-1 font-mono text-[10px]">{data.sessionId}</p>
			{:else if data.firstPrompt}
				<h1 class="text-text-300 text-sm font-bold italic">{data.firstPrompt}</h1>
				<p class="text-text-500 mt-1 font-mono text-[10px]">{data.sessionId}</p>
			{:else}
				<h1 class="text-text-100 text-sm font-bold">Session {data.sessionId.slice(0, 8)}...</h1>
				<p class="text-text-500 mt-1 font-mono text-[11px]">{data.sessionId}</p>
			{/if}
			{#if data.isSubagent && data.parentSessionId}
				<a
					href={resolve(`/session/${data.projectId}/${data.parentSessionId}`)}
					class="text-accent-400/70 hover:text-accent-400 mt-1 text-[10px] transition-colors"
					>Parent session {data.parentSessionId.slice(0, 8)}...</a
				>
			{/if}
		</div>
		<div class="text-text-500 flex items-center gap-4 text-[11px]">
			{#if data.isSubagent}
				<span class="bg-surface-800 text-text-300 rounded px-1.5 py-0.5 text-[10px] font-medium"
					>Subagent</span
				>
			{/if}
			<span>{data.messages.length} messages</span>
			{#if data.messages[0]?.model}
				<span
					class="bg-accent-500/10 border-accent-500/20 text-accent-300 rounded border px-1.5 py-0.5"
					>{data.messages[0].model}</span
				>
			{/if}
		</div>
	</div>

	<MessageThread messages={data.messages} />
</div>
