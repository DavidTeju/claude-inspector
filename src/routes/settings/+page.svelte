<script lang="ts">
	import { enhance } from '$app/forms';

	let { data, form } = $props();
</script>

<svelte:head>
	<title>Settings - Claude Inspector</title>
</svelte:head>

<div class="mx-auto max-w-xl">
	<div class="mb-6">
		<h1 class="text-text-100 text-lg font-bold">Settings</h1>
		<p class="text-text-500 mt-1 text-xs">Configure Claude Inspector</p>
	</div>

	<div class="border-surface-800 bg-surface-900/50 rounded-lg border p-6">
		<h2 class="text-text-100 mb-1 text-sm font-semibold">Anthropic API Key</h2>
		<p class="text-text-500 mb-4 text-xs">
			Used to generate session summaries via Haiku for sessions that don't have one. Optional —
			without it, the first prompt is shown as the title instead.
		</p>

		{#if form?.success}
			<div
				class="border-success-500/30 bg-success-500/10 text-success-500 mb-4 rounded-md border px-3 py-2 text-xs"
			>
				{form.cleared
					? 'API key cleared.'
					: 'API key saved. Summary generation will run in the background.'}
			</div>
		{/if}

		{#if form?.error}
			<div
				class="border-error-500/30 bg-error-500/10 text-error-400 mb-4 rounded-md border px-3 py-2 text-xs"
			>
				{form.error}
			</div>
		{/if}

		{#if data.hasApiKey}
			<div class="mb-4 flex items-center gap-2">
				<span class="text-text-300 text-xs">Current key:</span>
				<code class="text-text-500 font-mono text-xs">{data.maskedKey}</code>
			</div>
		{/if}

		<form method="POST" action="?/save" use:enhance class="space-y-3">
			<input
				name="apiKey"
				type="password"
				placeholder="sk-ant-api03-..."
				class="border-surface-800 bg-surface-950 text-text-100 placeholder-text-500 focus:border-accent-500/50 input-glow w-full rounded-md border px-3 py-2 font-mono text-xs outline-none"
			/>
			<div class="flex gap-2">
				<button
					type="submit"
					class="bg-accent-500 hover:bg-accent-400 text-surface-950 rounded-md px-4 py-1.5 text-xs font-medium transition-colors"
				>
					Save Key
				</button>
			</div>
		</form>

		{#if data.hasApiKey}
			<form method="POST" action="?/clear" use:enhance class="mt-3">
				<button
					type="submit"
					class="border-surface-700 text-text-300 hover:border-surface-600 hover:text-text-100 rounded-md border px-4 py-1.5 text-xs transition-colors"
				>
					Clear Key
				</button>
			</form>
		{/if}
	</div>
</div>
