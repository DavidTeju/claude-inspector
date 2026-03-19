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
	<div class="mb-8">
		<h1 class="text-3xl font-bold">Settings</h1>
		<p class="mt-2 opacity-60">
			Configure the app theme, API key, and interactive session defaults.
		</p>
	</div>

	<!-- Appearance section -->
	<div class="card bg-base-200 shadow-sm">
		<div class="card-body">
			<h2 class="card-title text-base">Appearance</h2>
			<p class="text-sm opacity-60">Choose your preferred color scheme.</p>

			<div class="join mt-2 w-full">
				{#each themeOptions as option (option.value)}
					<button
						onclick={() => theme.setPreference(option.value)}
						class="join-item btn btn-sm flex-1
							{theme.preference === option.value ? 'btn-active btn-primary' : ''}"
					>
						{option.label}
					</button>
				{/each}
			</div>
		</div>
	</div>

	<!-- API Key section -->
	<div class="card bg-base-200 mt-6 shadow-sm">
		<div class="card-body">
			<h2 class="card-title text-base">Anthropic API Key</h2>
			<p class="text-sm opacity-60">
				Used to generate session summaries via Haiku for sessions that don't have one. Optional —
				without it, the first prompt is shown as the title instead.
			</p>

			{#if form?.success && form?.section === 'apiKey'}
				<div class="alert alert-success text-sm">
					{form.cleared
						? 'API key cleared.'
						: 'API key saved. Summary generation will run in the background.'}
				</div>
			{/if}

			{#if form?.error && form?.section !== 'session'}
				<div class="alert alert-error text-sm">
					{form.error}
				</div>
			{/if}

			{#if data.hasApiKey}
				<div class="flex items-center gap-2">
					<span class="text-sm opacity-70">Current key:</span>
					<code class="badge badge-ghost font-mono">{data.maskedKey}</code>
				</div>
			{/if}

			<form method="POST" action="?/save" use:enhance class="mt-2">
				<fieldset class="fieldset">
					<input
						name="apiKey"
						type="password"
						placeholder="sk-ant-api03-..."
						class="input input-bordered w-full font-mono text-sm"
					/>
					<div class="mt-3 flex gap-2">
						<button type="submit" class="btn btn-primary btn-sm"> Save Key </button>
						{#if data.hasApiKey}
							<button type="submit" formaction="?/clear" class="btn btn-ghost btn-sm">
								Clear Key
							</button>
						{/if}
					</div>
				</fieldset>
			</form>
		</div>
	</div>

	<!-- Interactive Sessions section -->
	<div class="card bg-base-200 mt-6 shadow-sm">
		<div class="card-body">
			<h2 class="card-title text-base">Interactive Sessions</h2>
			<p class="text-sm opacity-60">Defaults for new Claude sessions.</p>

			{#if form?.success && form?.section === 'session'}
				<div class="alert alert-success text-sm">Session settings saved.</div>
			{/if}

			{#if form?.error && form?.section === 'session'}
				<div class="alert alert-error text-sm">
					{form.error}
				</div>
			{/if}

			<form method="POST" action="?/saveSessionConfig" use:enhance class="mt-2 space-y-4">
				<fieldset class="fieldset">
					<legend class="fieldset-legend">Default Permission Mode</legend>
					<select
						id="settings-permission"
						name="permissionMode"
						value={data.defaultPermissionMode}
						class="select select-bordered w-full"
					>
						{#each PERMISSION_MODES as mode (mode)}
							<option value={mode}>{PERMISSION_MODE_LABELS[mode]}</option>
						{/each}
					</select>
				</fieldset>

				<fieldset class="fieldset">
					<legend class="fieldset-legend">Default Model</legend>
					<input
						id="settings-model"
						name="model"
						value={data.defaultModel}
						placeholder="SDK default"
						class="input input-bordered w-full"
					/>
				</fieldset>

				<div class="grid grid-cols-2 gap-4">
					<fieldset class="fieldset">
						<legend class="fieldset-legend">Permission Timeout</legend>
						<label class="input input-bordered flex w-full items-center gap-2">
							<input
								id="settings-perm-timeout"
								name="permissionTimeout"
								type="number"
								min="1"
								max="60"
								value={data.permissionTimeoutMinutes}
								class="grow"
							/>
							<span class="badge badge-ghost badge-sm">min</span>
						</label>
					</fieldset>

					<fieldset class="fieldset">
						<legend class="fieldset-legend">Session Reap Timeout</legend>
						<label class="input input-bordered flex w-full items-center gap-2">
							<input
								id="settings-reap-timeout"
								name="sessionReap"
								type="number"
								min="5"
								max="1440"
								value={data.sessionReapMinutes}
								class="grow"
							/>
							<span class="badge badge-ghost badge-sm">min</span>
						</label>
					</fieldset>
				</div>

				<button type="submit" class="btn btn-primary btn-sm"> Save Settings </button>
			</form>
		</div>
	</div>
</div>
