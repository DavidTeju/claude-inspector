<script lang="ts">
	import { SESSION_ID_DISPLAY_LENGTH } from '$lib/constants.js';
	import type {
		ActiveSessionState,
		PermissionMode,
		SessionCost
	} from '$lib/shared/active-session-types.js';
	import { getCyclableModes, PERMISSION_MODE_LABELS } from '$lib/shared/permission-modes.js';
	import { STATE_COLORS } from '$lib/shared/state-colors.js';
	import CostDisplay from './CostDisplay.svelte';
	import { resolve } from '$app/paths';

	const COPY_FEEDBACK_DURATION_MS = 2000;

	let {
		sessionTitle = '',
		sessionId = '',
		model = '',
		messageCount = 0,
		permissionMode,
		onPermissionModeChange,
		dangerousPermissionsAllowed = false,
		isActive = false,
		sessionState = 'idle' as ActiveSessionState,
		cost,
		onInterrupt,
		showResumeCommand = true,
		isSubagent = false,
		parentSessionId = '',
		projectId = '',
		reconnecting = false,
		error = '',
		resumeError = ''
	}: {
		sessionTitle?: string;
		sessionId?: string;
		model?: string;
		messageCount?: number;
		permissionMode: PermissionMode;
		onPermissionModeChange: (mode: PermissionMode) => void;
		dangerousPermissionsAllowed?: boolean;
		isActive?: boolean;
		sessionState?: ActiveSessionState;
		cost?: SessionCost;
		onInterrupt?: () => void;
		showResumeCommand?: boolean;
		isSubagent?: boolean;
		parentSessionId?: string;
		projectId?: string;
		reconnecting?: boolean;
		error?: string;
		resumeError?: string;
	} = $props();

	const stateLabels: Record<ActiveSessionState, { label: string; pulse: boolean }> = {
		initializing: { label: 'Initializing', pulse: true },
		running: { label: 'Running', pulse: true },
		awaiting_permission: { label: 'Awaiting Permission', pulse: true },
		awaiting_input: { label: 'Awaiting Input', pulse: true },
		rate_limited: { label: 'Rate Limited', pulse: false },
		compacting: { label: 'Compacting', pulse: true },
		idle: { label: 'Idle', pulse: false },
		error: { label: 'Error', pulse: false },
		closed: { label: 'Closed', pulse: false }
	};

	function cyclePermissionMode() {
		const modes = getCyclableModes(dangerousPermissionsAllowed);
		const currentIdx = modes.indexOf(permissionMode);
		const nextIdx = (currentIdx + 1) % modes.length;
		onPermissionModeChange(modes[nextIdx]);
	}

	let currentColor = $derived(STATE_COLORS[sessionState]);
	let currentLabel = $derived(stateLabels[sessionState]);
	let canInterrupt = $derived(sessionState === 'running' || sessionState === 'compacting');

	let copied = $state(false);
	function copyResumeCommand() {
		navigator.clipboard.writeText(`claude --resume ${sessionId}`);
		copied = true;
		setTimeout(() => (copied = false), COPY_FEEDBACK_DURATION_MS);
	}
</script>

<div
	class="border-surface-800 bg-surface-900/70 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5 overflow-hidden rounded-xl border px-4 py-2.5"
>
	<!-- Title (truncated) -->
	{#if sessionTitle}
		<span class="text-text-100 min-w-0 truncate text-sm font-medium" title={sessionTitle}>
			{sessionTitle}
		</span>
		<span class="text-surface-700">·</span>
	{/if}

	{#if isActive}
		<!-- Active mode: state pill -->
		<div class="flex items-center gap-1.5">
			<span class="h-2 w-2 rounded-full {currentColor} {currentLabel.pulse ? 'animate-pulse' : ''}"
			></span>
			<span class="text-text-300 text-xs font-medium">{currentLabel.label}</span>
		</div>

		<!-- Interrupt button -->
		{#if canInterrupt && onInterrupt}
			<button
				onclick={onInterrupt}
				aria-label="Interrupt session"
				class="border-error-500/20 bg-error-500/10 text-error-400 hover:bg-error-500/20 flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition-colors"
			>
				<svg class="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
					<rect x="6" y="6" width="12" height="12" rx="1" />
				</svg>
				Stop
			</button>
		{/if}
	{:else}
		<!-- Idle mode: message count -->
		{#if messageCount > 0}
			<span class="text-text-500 text-xs">{messageCount} msg{messageCount !== 1 ? 's' : ''}</span>
			<span class="text-surface-700">·</span>
		{/if}
	{/if}

	<!-- Permission mode (always) -->
	<button
		onclick={cyclePermissionMode}
		aria-label="Cycle permission mode"
		class="bg-surface-800 text-text-300 hover:bg-surface-700 cursor-pointer rounded-lg px-3 py-1.5 text-xs transition-colors"
		title="Click to cycle permission mode"
	>
		{PERMISSION_MODE_LABELS[permissionMode] ?? permissionMode}
	</button>

	<!-- Model display -->
	{#if model}
		<span class="text-text-500 min-w-0 truncate font-mono text-xs">{model}</span>
	{/if}

	<div class="ml-auto flex items-center gap-2">
		{#if isActive && cost}
			<!-- Active: cost display -->
			<CostDisplay {cost} />
		{:else if !isActive && sessionId && showResumeCommand}
			<!-- Idle: copy resume command -->
			<button
				onclick={copyResumeCommand}
				class="text-text-500 hover:text-text-300 flex cursor-pointer items-center gap-1.5 text-xs transition-colors"
				title="Copy resume command"
			>
				<code class="text-text-600 max-w-[10rem] truncate font-mono text-[10px]"
					>claude --resume {sessionId.slice(0, SESSION_ID_DISPLAY_LENGTH)}...</code
				>
				{#if copied}
					<svg
						class="text-success-400 h-3.5 w-3.5"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="2"
					>
						<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
					</svg>
				{:else}
					<svg
						class="h-3.5 w-3.5"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="2"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
						/>
					</svg>
				{/if}
			</button>
		{/if}
	</div>
</div>

{#if isSubagent && parentSessionId}
	<div class="mt-2">
		<a
			href={resolve(`/session/${projectId}/${parentSessionId}`)}
			class="text-accent-400/70 hover:text-accent-400 text-xs transition-colors"
			>Parent session {parentSessionId.slice(0, SESSION_ID_DISPLAY_LENGTH)}...</a
		>
	</div>
{/if}

{#if reconnecting}
	<div
		class="bg-warning-500/10 text-warning-500 mt-2 rounded-md px-3 py-1.5 text-center text-[11px]"
	>
		Reconnecting...
	</div>
{/if}

{#if error}
	<div class="bg-error-500/10 text-error-400 mt-2 rounded-md px-3 py-1.5 text-center text-[11px]">
		{error}
	</div>
{/if}

{#if resumeError}
	<div class="bg-error-500/10 text-error-400 mt-2 rounded-md px-3 py-1.5 text-center text-[11px]">
		{resumeError}
	</div>
{/if}
