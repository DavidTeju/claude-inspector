<script lang="ts">
	import { PERMISSION_MODES, PERMISSION_MODE_LABELS } from '$lib/shared/permission-modes.js';
	import { theme, type ThemePreference } from '$lib/stores/theme.svelte.js';
	import { enhance } from '$app/forms';

	let { data, form } = $props();

	const themeOptions: Array<{ value: ThemePreference; label: string }> = [
		{ value: 'system', label: 'System' },
		{ value: 'light', label: 'Light' },
		{ value: 'dark', label: 'Dark' }
	];
</script>

<svelte:head>
	<title>Settings - Claude Inspector</title>
</svelte:head>

<div class="mx-auto max-w-xl">
	<div class="mb-6">
		<h1 class="page-title">Settings</h1>
		<p class="page-subtitle">Configure the app theme, API key, and interactive session defaults.</p>
	</div>

	<!-- Appearance section -->
	<div class="border-surface-800 bg-surface-900/50 rounded-2xl border p-6">
		<h2 class="section-title">Appearance</h2>
		<p class="section-subtitle">Choose your preferred color scheme.</p>

		<div class="flex gap-2">
			{#each themeOptions as option (option.value)}
				<button
					onclick={() => theme.setPreference(option.value)}
					class="flex-1 rounded-lg border px-3 py-2.5 text-center text-sm font-medium transition-colors
						{theme.preference === option.value
						? 'border-accent-500/50 bg-accent-500/10 text-accent-400'
						: 'border-surface-800 bg-surface-950 text-text-500 hover:border-surface-700 hover:text-text-100'}"
				>
					{option.label}
				</button>
			{/each}
		</div>
	</div>

	<!-- API Key section -->
	<div class="border-surface-800 bg-surface-900/50 mt-8 rounded-2xl border p-6">
		<h2 class="section-title">Anthropic API Key</h2>
		<p class="section-subtitle mb-4">
			Used to generate session summaries via Haiku for sessions that don't have one. Optional —
			without it, the first prompt is shown as the title instead.
		</p>

		{#if form?.success && form?.section === 'apiKey'}
			<div
				class="border-success-500/30 bg-success-500/10 text-success-500 mb-4 rounded-md border px-3 py-2 text-xs"
			>
				{form.cleared
					? 'API key cleared.'
					: 'API key saved. Summary generation will run in the background.'}
			</div>
		{/if}

		{#if form?.error && form?.section === 'apiKey'}
			<div
				class="border-error-500/30 bg-error-500/10 text-error-400 mb-4 rounded-md border px-3 py-2 text-xs"
			>
				{form.error}
			</div>
		{/if}

		{#if data.hasApiKey}
			<div class="mb-4 flex items-center gap-2">
				<span class="text-text-300 text-sm">Current key:</span>
				<code class="text-text-500 font-mono text-sm">{data.maskedKey}</code>
			</div>
		{/if}

		<form method="POST" action="?/save" use:enhance class="space-y-3">
			<input
				name="apiKey"
				type="password"
				placeholder="sk-ant-api03-..."
				class="border-surface-800 bg-surface-950 text-text-100 placeholder-text-500 focus:border-accent-500/50 input-glow w-full rounded-md border px-3 py-2.5 font-mono text-sm outline-none"
			/>
			<div class="flex gap-2">
				<button
					type="submit"
					class="bg-accent-500 hover:bg-accent-400 text-surface-950 rounded-md px-4 py-2 text-sm font-medium transition-colors"
				>
					Save Key
				</button>
			</div>
		</form>

		{#if data.hasApiKey}
			<form method="POST" action="?/clear" use:enhance class="mt-3">
				<button
					type="submit"
					class="border-surface-700 text-text-300 hover:border-surface-600 hover:text-text-100 rounded-md border px-4 py-2 text-sm transition-colors"
				>
					Clear Key
				</button>
			</form>
		{/if}
	</div>

	<!-- Interactive Sessions section -->
	<div class="border-surface-800 bg-surface-900/50 mt-8 rounded-2xl border p-6">
		<h2 class="section-title">Interactive Sessions</h2>
		<p class="section-subtitle mb-4">Defaults for new Claude sessions.</p>

		{#if form?.success && form?.section === 'session'}
			<div
				class="border-success-500/30 bg-success-500/10 text-success-500 mb-4 rounded-md border px-3 py-2 text-xs"
			>
				Session settings saved.
			</div>
		{/if}

		{#if form?.error && form?.section === 'session'}
			<div
				class="border-error-500/30 bg-error-500/10 text-error-400 mb-4 rounded-md border px-3 py-2 text-xs"
			>
				{form.error}
			</div>
		{/if}

		<form method="POST" action="?/saveSessionConfig" use:enhance class="space-y-4">
			<!-- Permission mode -->
			<div>
				<label for="settings-permission" class="text-text-300 mb-1.5 block text-xs font-medium"
					>Default Permission Mode</label
				>
				<select
					id="settings-permission"
					name="permissionMode"
					value={data.defaultPermissionMode}
					class="border-surface-800 bg-surface-950 text-text-100 input-glow w-full rounded-md border px-3 py-2.5 text-sm outline-none"
				>
					{#each PERMISSION_MODES as mode (mode)}
						<option value={mode}>{PERMISSION_MODE_LABELS[mode]}</option>
					{/each}
				</select>
			</div>

			<!-- Model -->
			<div>
				<label for="settings-model" class="text-text-300 mb-1.5 block text-xs font-medium"
					>Default Model</label
				>
				<input
					id="settings-model"
					name="model"
					value={data.defaultModel}
					placeholder="SDK default"
					class="border-surface-800 bg-surface-950 text-text-100 placeholder-text-500 input-glow w-full rounded-md border px-3 py-2.5 text-sm outline-none"
				/>
			</div>

			<!-- Permission timeout -->
			<div>
				<label for="settings-perm-timeout" class="text-text-300 mb-1.5 block text-xs font-medium"
					>Permission Timeout</label
				>
				<div class="flex items-center gap-2">
					<input
						id="settings-perm-timeout"
						name="permissionTimeout"
						type="number"
						min="1"
						max="60"
						value={data.permissionTimeoutMinutes}
						class="border-surface-800 bg-surface-950 text-text-100 input-glow w-24 rounded-md border px-3 py-2.5 text-sm outline-none"
					/>
					<span class="text-text-500 text-xs">minutes</span>
				</div>
			</div>

			<!-- Session reap timeout -->
			<div>
				<label for="settings-reap-timeout" class="text-text-300 mb-1.5 block text-xs font-medium"
					>Session Reap Timeout</label
				>
				<div class="flex items-center gap-2">
					<input
						id="settings-reap-timeout"
						name="sessionReap"
						type="number"
						min="5"
						max="1440"
						value={data.sessionReapMinutes}
						class="border-surface-800 bg-surface-950 text-text-100 input-glow w-24 rounded-md border px-3 py-2.5 text-sm outline-none"
					/>
					<span class="text-text-500 text-xs">minutes</span>
				</div>
			</div>

			<button
				type="submit"
				class="bg-accent-500 hover:bg-accent-400 text-surface-950 rounded-md px-4 py-2 text-sm font-medium transition-colors"
			>
				Save Settings
			</button>
		</form>
	</div>
</div>
