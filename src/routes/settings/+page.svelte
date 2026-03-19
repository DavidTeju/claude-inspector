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
		<h1 class="text-2xl font-bold tracking-tight lg:text-3xl">Settings</h1>
		<p class="text-base-content/50 mt-2 text-sm">
			Configure the app theme, API key, and interactive session defaults.
		</p>
	</div>

	<!-- Appearance section -->
	<div class="card bg-base-200/50 border-base-content/10 border">
		<div class="card-body">
			<h2 class="text-base font-semibold">Appearance</h2>
			<p class="text-base-content/50 mt-1 text-xs">Choose your preferred color scheme.</p>

			<div class="join w-full">
				{#each themeOptions as option (option.value)}
					<button
						onclick={() => theme.setPreference(option.value)}
						class="join-item btn btn-sm flex-1
							{theme.preference === option.value ? 'btn-primary btn-outline' : 'btn-ghost'}"
					>
						{option.label}
					</button>
				{/each}
			</div>
		</div>
	</div>

	<!-- API Key section -->
	<div class="card bg-base-200/50 border-base-content/10 mt-8 border">
		<div class="card-body">
			<h2 class="text-base font-semibold">Anthropic API Key</h2>
			<p class="text-base-content/50 mt-1 mb-4 text-xs">
				Used to generate session summaries via Haiku for sessions that don't have one. Optional —
				without it, the first prompt is shown as the title instead.
			</p>

			{#if form?.success && form?.section === 'apiKey'}
				<div class="alert alert-success mb-4 text-xs">
					{form.cleared
						? 'API key cleared.'
						: 'API key saved. Summary generation will run in the background.'}
				</div>
			{/if}

			{#if form?.error && form?.section !== 'session'}
				<div class="alert alert-error mb-4 text-xs">
					{form.error}
				</div>
			{/if}

			{#if data.hasApiKey}
				<div class="mb-4 flex items-center gap-2">
					<span class="text-base-content/70 text-sm">Current key:</span>
					<code class="text-base-content/50 font-mono text-sm">{data.maskedKey}</code>
				</div>
			{/if}

			<form method="POST" action="?/save" use:enhance class="space-y-3">
				<input
					name="apiKey"
					type="password"
					placeholder="sk-ant-api03-..."
					class="input input-bordered w-full font-mono text-sm"
				/>
				<div class="flex gap-2">
					<button type="submit" class="btn btn-primary btn-sm"> Save Key </button>
				</div>
			</form>

			{#if data.hasApiKey}
				<form method="POST" action="?/clear" use:enhance class="mt-3">
					<button type="submit" class="btn btn-outline btn-sm"> Clear Key </button>
				</form>
			{/if}
		</div>
	</div>

	<!-- Interactive Sessions section -->
	<div class="card bg-base-200/50 border-base-content/10 mt-8 border">
		<div class="card-body">
			<h2 class="text-base font-semibold">Interactive Sessions</h2>
			<p class="text-base-content/50 mt-1 mb-4 text-xs">Defaults for new Claude sessions.</p>

			{#if form?.success && form?.section === 'session'}
				<div class="alert alert-success mb-4 text-xs">Session settings saved.</div>
			{/if}

			{#if form?.error && form?.section === 'session'}
				<div class="alert alert-error mb-4 text-xs">
					{form.error}
				</div>
			{/if}

			<form method="POST" action="?/saveSessionConfig" use:enhance class="space-y-4">
				<!-- Permission mode -->
				<div>
					<label
						for="settings-permission"
						class="text-base-content/70 mb-1.5 block text-xs font-medium"
						>Default Permission Mode</label
					>
					<select
						id="settings-permission"
						name="permissionMode"
						value={data.defaultPermissionMode}
						class="select select-bordered select-sm w-full"
					>
						{#each PERMISSION_MODES as mode (mode)}
							<option value={mode}>{PERMISSION_MODE_LABELS[mode]}</option>
						{/each}
					</select>
				</div>

				<!-- Model -->
				<div>
					<label for="settings-model" class="text-base-content/70 mb-1.5 block text-xs font-medium"
						>Default Model</label
					>
					<input
						id="settings-model"
						name="model"
						value={data.defaultModel}
						placeholder="SDK default"
						class="input input-bordered input-sm w-full"
					/>
				</div>

				<!-- Permission timeout -->
				<div>
					<label
						for="settings-perm-timeout"
						class="text-base-content/70 mb-1.5 block text-xs font-medium">Permission Timeout</label
					>
					<div class="flex items-center gap-2">
						<input
							id="settings-perm-timeout"
							name="permissionTimeout"
							type="number"
							min="1"
							max="60"
							value={data.permissionTimeoutMinutes}
							class="input input-bordered input-sm w-24"
						/>
						<span class="text-base-content/50 text-xs">minutes</span>
					</div>
				</div>

				<!-- Session reap timeout -->
				<div>
					<label
						for="settings-reap-timeout"
						class="text-base-content/70 mb-1.5 block text-xs font-medium"
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
							class="input input-bordered input-sm w-24"
						/>
						<span class="text-base-content/50 text-xs">minutes</span>
					</div>
				</div>

				<button type="submit" class="btn btn-primary btn-sm"> Save Settings </button>
			</form>
		</div>
	</div>
</div>
