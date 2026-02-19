<script lang="ts">
	import { enhance } from '$app/forms';

	let { data, form } = $props();
</script>

<svelte:head>
	<title>Settings - Claude Inspector</title>
</svelte:head>

<div class="mx-auto max-w-xl">
	<div class="mb-6">
		<h1 class="text-lg font-bold text-zinc-100">Settings</h1>
		<p class="mt-1 text-xs text-zinc-500">Configure Claude Inspector</p>
	</div>

	<div class="rounded-lg border border-zinc-800 bg-zinc-900/50 p-6">
		<h2 class="text-sm font-semibold text-zinc-200 mb-1">Anthropic API Key</h2>
		<p class="text-xs text-zinc-500 mb-4">
			Used to generate session summaries via Haiku for sessions that don't have one. Optional —
			without it, the first prompt is shown as the title instead.
		</p>

		{#if form?.success}
			<div
				class="mb-4 rounded-md border border-green-800/50 bg-green-900/20 px-3 py-2 text-xs text-green-400"
			>
				{form.cleared
					? 'API key cleared.'
					: 'API key saved. Summary generation will run in the background.'}
			</div>
		{/if}

		{#if form?.error}
			<div
				class="mb-4 rounded-md border border-red-800/50 bg-red-900/20 px-3 py-2 text-xs text-red-400"
			>
				{form.error}
			</div>
		{/if}

		{#if data.hasApiKey}
			<div class="mb-4 flex items-center gap-2">
				<span class="text-xs text-zinc-400">Current key:</span>
				<code class="text-xs text-zinc-500 font-mono">{data.maskedKey}</code>
			</div>
		{/if}

		<form method="POST" action="?/save" use:enhance class="space-y-3">
			<input
				name="apiKey"
				type="password"
				placeholder="sk-ant-api03-..."
				class="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-300 font-mono placeholder-zinc-700 outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600"
			/>
			<div class="flex gap-2">
				<button
					type="submit"
					class="rounded-md bg-accent-500 px-4 py-1.5 text-xs font-medium text-white transition-colors hover:bg-accent-400"
				>
					Save Key
				</button>
				{#if data.hasApiKey}
					<form method="POST" action="?/clear" use:enhance>
						<button
							type="submit"
							class="rounded-md border border-zinc-700 px-4 py-1.5 text-xs text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-300"
						>
							Clear Key
						</button>
					</form>
				{/if}
			</div>
		</form>
	</div>
</div>
