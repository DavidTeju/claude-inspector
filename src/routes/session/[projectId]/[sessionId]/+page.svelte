<script lang="ts">
	import MessageThread from '$lib/components/MessageThread.svelte';

	let { data } = $props();
</script>

<svelte:head>
	<title>Session {data.sessionId.slice(0, 8)} - Claude Inspector</title>
</svelte:head>

<div class="mx-auto max-w-4xl">
	<!-- Session header -->
	<div class="mb-6 flex items-center gap-4 rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
		<div class="flex-1">
			<h1 class="text-sm font-bold text-zinc-200">Session {data.sessionId.slice(0, 8)}...</h1>
			<p class="mt-1 font-mono text-[11px] text-zinc-500">{data.sessionId}</p>
		</div>
		<div class="flex items-center gap-4 text-[11px] text-zinc-500">
			<span>{data.messages.length} messages</span>
			{#if data.messages[0]?.model}
				<span class="rounded bg-zinc-800 px-1.5 py-0.5 text-zinc-400">{data.messages[0].model}</span
				>
			{/if}
		</div>
	</div>

	<MessageThread messages={data.messages} />
</div>
