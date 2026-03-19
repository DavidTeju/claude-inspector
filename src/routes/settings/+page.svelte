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
		<h1 class="text-3xl font-bold tracking-tight text-foreground lg:text-4xl">Settings</h1>
		<p class="mt-2 text-sm text-muted-foreground">Configure the app theme, API key, and interactive session defaults.</p>
	</div>

	<!-- Appearance section -->
	<div class="border-border bg-card/50 rounded-2xl border p-6">
		<h2 class="text-base font-semibold tracking-tight text-foreground">Appearance</h2>
		<p class="mt-1 text-sm text-muted-foreground">Choose your preferred color scheme.</p>

		<div class="flex gap-2">
			{#each themeOptions as option (option.value)}
				<button
					onclick={() => theme.setPreference(option.value)}
					class="flex-1 rounded-lg border px-3 py-2.5 text-center text-sm font-medium transition-colors
						{theme.preference === option.value
						? 'border-primary/50 bg-primary/10 text-primary'
						: 'border-border bg-background text-muted-foreground hover:border-border hover:text-foreground'}"
				>
					{option.label}
				</button>
			{/each}
		</div>
	</div>

	<!-- API Key section -->
	<div class="border-border bg-card/50 mt-8 rounded-2xl border p-6">
		<h2 class="text-base font-semibold tracking-tight text-foreground">Anthropic API Key</h2>
		<p class="mt-1 text-sm text-muted-foreground mb-4">
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

		{#if form?.error && form?.section !== 'session'}
			<div
				class="border-destructive/30 bg-destructive/10 text-destructive mb-4 rounded-md border px-3 py-2 text-xs"
			>
				{form.error}
			</div>
		{/if}

		{#if data.hasApiKey}
			<div class="mb-4 flex items-center gap-2">
				<span class="text-foreground/80 text-sm">Current key:</span>
				<code class="text-muted-foreground font-mono text-sm">{data.maskedKey}</code>
			</div>
		{/if}

		<form method="POST" action="?/save" use:enhance class="space-y-3">
			<input
				name="apiKey"
				type="password"
				placeholder="sk-ant-api03-..."
				class="border-border bg-background text-foreground placeholder-muted-foreground focus:border-ring w-full rounded-md border px-3 py-2.5 font-mono text-sm outline-none"
			/>
			<div class="flex gap-2">
				<button
					type="submit"
					class="bg-primary hover:bg-primary/90 text-primary-foreground rounded-md px-4 py-2 text-sm font-medium transition-colors"
				>
					Save Key
				</button>
			</div>
		</form>

		{#if data.hasApiKey}
			<form method="POST" action="?/clear" use:enhance class="mt-3">
				<button
					type="submit"
					class="border-border text-foreground/80 hover:border-border hover:text-foreground rounded-md border px-4 py-2 text-sm transition-colors"
				>
					Clear Key
				</button>
			</form>
		{/if}
	</div>

	<!-- Interactive Sessions section -->
	<div class="border-border bg-card/50 mt-8 rounded-2xl border p-6">
		<h2 class="text-base font-semibold tracking-tight text-foreground">Interactive Sessions</h2>
		<p class="mt-1 text-sm text-muted-foreground mb-4">Defaults for new Claude sessions.</p>

		{#if form?.success && form?.section === 'session'}
			<div
				class="border-success-500/30 bg-success-500/10 text-success-500 mb-4 rounded-md border px-3 py-2 text-xs"
			>
				Session settings saved.
			</div>
		{/if}

		{#if form?.error && form?.section === 'session'}
			<div
				class="border-destructive/30 bg-destructive/10 text-destructive mb-4 rounded-md border px-3 py-2 text-xs"
			>
				{form.error}
			</div>
		{/if}

		<form method="POST" action="?/saveSessionConfig" use:enhance class="space-y-4">
			<!-- Permission mode -->
			<div>
				<label for="settings-permission" class="text-foreground/80 mb-1.5 block text-xs font-medium"
					>Default Permission Mode</label
				>
				<select
					id="settings-permission"
					name="permissionMode"
					value={data.defaultPermissionMode}
					class="border-border bg-background text-foreground w-full rounded-md border px-3 py-2.5 text-sm outline-none"
				>
					{#each PERMISSION_MODES as mode (mode)}
						<option value={mode}>{PERMISSION_MODE_LABELS[mode]}</option>
					{/each}
				</select>
			</div>

			<!-- Model -->
			<div>
				<label for="settings-model" class="text-foreground/80 mb-1.5 block text-xs font-medium"
					>Default Model</label
				>
				<input
					id="settings-model"
					name="model"
					value={data.defaultModel}
					placeholder="SDK default"
					class="border-border bg-background text-foreground placeholder-muted-foreground w-full rounded-md border px-3 py-2.5 text-sm outline-none"
				/>
			</div>

			<!-- Permission timeout -->
			<div>
				<label for="settings-perm-timeout" class="text-foreground/80 mb-1.5 block text-xs font-medium"
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
						class="border-border bg-background text-foreground w-24 rounded-md border px-3 py-2.5 text-sm outline-none"
					/>
					<span class="text-muted-foreground text-xs">minutes</span>
				</div>
			</div>

			<!-- Session reap timeout -->
			<div>
				<label for="settings-reap-timeout" class="text-foreground/80 mb-1.5 block text-xs font-medium"
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
						class="border-border bg-background text-foreground w-24 rounded-md border px-3 py-2.5 text-sm outline-none"
					/>
					<span class="text-muted-foreground text-xs">minutes</span>
				</div>
			</div>

			<button
				type="submit"
				class="bg-primary hover:bg-primary/90 text-primary-foreground rounded-md px-4 py-2 text-sm font-medium transition-colors"
			>
				Save Settings
			</button>
		</form>
	</div>
</div>
