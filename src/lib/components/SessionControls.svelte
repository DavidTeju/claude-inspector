<script lang="ts">
	import CostDisplay from './CostDisplay.svelte';
	import type {
		ActiveSessionState,
		PermissionMode,
		SessionCost
	} from '$lib/shared/active-session-types.js';

	let {
		state,
		model,
		permissionMode,
		cost,
		onInterrupt,
		onPermissionModeChange
	}: {
		state: ActiveSessionState;
		model: string;
		permissionMode: PermissionMode;
		cost: SessionCost;
		onInterrupt: () => void;
		onPermissionModeChange: (mode: PermissionMode) => void;
	} = $props();

	const stateConfig: Record<ActiveSessionState, { label: string; color: string; pulse: boolean }> =
		{
			initializing: { label: 'Initializing', color: 'bg-text-500', pulse: true },
			running: { label: 'Running', color: 'bg-accent-400', pulse: true },
			awaiting_permission: { label: 'Awaiting Permission', color: 'bg-warning-500', pulse: true },
			awaiting_input: { label: 'Awaiting Input', color: 'bg-user-400', pulse: true },
			rate_limited: { label: 'Rate Limited', color: 'bg-error-500', pulse: false },
			compacting: { label: 'Compacting', color: 'bg-accent-300', pulse: true },
			idle: { label: 'Idle', color: 'bg-success-500', pulse: false },
			error: { label: 'Error', color: 'bg-error-500', pulse: false },
			closed: { label: 'Closed', color: 'bg-text-700', pulse: false }
		};

	const permissionModes: PermissionMode[] = ['default', 'acceptEdits', 'bypassPermissions', 'plan'];
	const permissionLabels: Record<string, string> = {
		default: 'Default',
		acceptEdits: 'Accept Edits',
		bypassPermissions: 'Bypass',
		plan: 'Plan',
		dontAsk: "Don't Ask"
	};

	function cyclePermissionMode() {
		const currentIdx = permissionModes.indexOf(permissionMode);
		const nextIdx = (currentIdx + 1) % permissionModes.length;
		onPermissionModeChange(permissionModes[nextIdx]);
	}

	let currentStateConfig = $derived(stateConfig[state]);
	let canInterrupt = $derived(state === 'running' || state === 'compacting');
</script>

<div
	class="border-surface-800 bg-surface-900/70 flex items-center gap-3 rounded-xl border px-4 py-2"
>
	<!-- State pill -->
	<div class="flex items-center gap-1.5">
		<span
			class="h-1.5 w-1.5 rounded-full {currentStateConfig.color} {currentStateConfig.pulse
				? 'animate-pulse'
				: ''}"
		></span>
		<span class="text-text-300 text-[10px]">{currentStateConfig.label}</span>
	</div>

	<!-- Interrupt button -->
	{#if canInterrupt}
		<button
			onclick={onInterrupt}
			class="border-error-500/20 bg-error-500/10 text-error-400 hover:bg-error-500/20 flex cursor-pointer items-center gap-1 rounded-lg border px-2.5 py-1 text-[10px] transition-colors"
		>
			<svg class="h-3 w-3" fill="currentColor" viewBox="0 0 24 24">
				<rect x="6" y="6" width="12" height="12" rx="1" />
			</svg>
			Stop
		</button>
	{/if}

	<!-- Permission mode -->
	<button
		onclick={cyclePermissionMode}
		class="bg-surface-800 text-text-300 hover:bg-surface-700 cursor-pointer rounded-lg px-2.5 py-1 text-[10px] transition-colors"
		title="Click to cycle permission mode"
	>
		{permissionLabels[permissionMode] ?? permissionMode}
	</button>

	<!-- Model display -->
	<span class="text-text-500 font-mono text-[10px]">{model}</span>

	<!-- Cost display -->
	<div class="ml-auto">
		<CostDisplay {cost} />
	</div>
</div>
