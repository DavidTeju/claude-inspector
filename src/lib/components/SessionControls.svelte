<script lang="ts">
	import { AlertTriangle, ArrowUpRight, Check, Copy, Square, XCircle } from '@lucide/svelte';
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

{#if isSubagent && parentSessionId}
	<a
		href={resolve(`/session/${projectId}/${parentSessionId}`)}
		class="bg-accent-500/10 text-accent-400 hover:bg-accent-500/20 mb-1.5 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition-colors"
	>
		<ArrowUpRight class="h-3 w-3" />
		Parent session
	</a>
{/if}

<div class="border-surface-800 bg-surface-900/70 overflow-hidden rounded-xl border">
	<!-- Row 1: Title + State + Stop -->
	<div class="flex items-center gap-2 px-4 pt-3 {isActive ? 'pb-1' : 'pb-2.5'}">
		{#if isActive}
			<span
				class="h-2 w-2 shrink-0 rounded-full {currentColor} {currentLabel.pulse
					? 'animate-pulse'
					: ''}"
			></span>
		{/if}
		{#if sessionTitle}
			<span class="text-text-100 min-w-0 truncate text-sm font-medium" title={sessionTitle}>
				{sessionTitle}
			</span>
		{/if}
		{#if isActive}
			<span class="text-text-500 shrink-0 text-xs">{currentLabel.label}</span>
			<button
				onclick={() => onInterrupt?.()}
				disabled={!canInterrupt}
				aria-label="Interrupt session"
				class="border-error-500/20 bg-error-500/10 text-error-400 ml-auto flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition-colors {canInterrupt
					? 'hover:bg-error-500/20 cursor-pointer'
					: 'cursor-not-allowed opacity-40'}"
			>
				<Square class="h-3.5 w-3.5" fill="currentColor" />
				Stop
			</button>
		{:else}
			{#if messageCount > 0}
				<span class="text-text-500 text-xs"
					>&middot; {messageCount} msg{messageCount !== 1 ? 's' : ''}</span
				>
			{/if}
			{#if sessionId && showResumeCommand}
				<button
					onclick={copyResumeCommand}
					class="text-text-500 hover:text-text-300 ml-auto flex cursor-pointer items-center gap-1.5 text-xs transition-colors"
					title="Copy resume command"
				>
					<code class="text-text-600 max-w-[10rem] truncate font-mono text-[10px]"
						>claude --resume {sessionId.slice(0, SESSION_ID_DISPLAY_LENGTH)}...</code
					>
					{#if copied}
						<Check class="text-success-500 h-3.5 w-3.5" />
					{:else}
						<Copy class="h-3.5 w-3.5" />
					{/if}
				</button>
			{/if}
		{/if}
	</div>

	<!-- Row 2: Metadata (active sessions only) -->
	{#if isActive}
		<div class="text-text-500 flex items-center gap-2 px-4 pb-2.5 text-xs">
			{#if messageCount > 0}
				<span>{messageCount} msg{messageCount !== 1 ? 's' : ''}</span>
				<span class="text-surface-700">&middot;</span>
			{/if}

			<button
				onclick={cyclePermissionMode}
				aria-label="Cycle permission mode"
				class="bg-surface-800 text-text-300 hover:bg-surface-700 cursor-pointer rounded-lg px-3 py-1 text-xs transition-colors"
				title="Click to cycle permission mode"
			>
				{PERMISSION_MODE_LABELS[permissionMode] ?? permissionMode}
			</button>

			{#if model}
				<span class="text-surface-700">&middot;</span>
				<span class="min-w-0 truncate font-mono text-[10px]">{model}</span>
			{/if}

			{#if cost}
				<div class="ml-auto">
					<CostDisplay {cost} />
				</div>
			{/if}
		</div>
	{/if}
</div>

{#if reconnecting}
	<div
		class="bg-warning-500/10 text-warning-500 mt-2 flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-[11px]"
	>
		<AlertTriangle class="h-3.5 w-3.5 shrink-0" />
		Reconnecting...
	</div>
{/if}

{#if error}
	<div
		class="bg-error-500/10 text-error-400 mt-2 flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-[11px]"
	>
		<XCircle class="h-3.5 w-3.5 shrink-0" />
		{error}
	</div>
{/if}

{#if resumeError}
	<div
		class="bg-error-500/10 text-error-400 mt-2 flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-[11px]"
	>
		<XCircle class="h-3.5 w-3.5 shrink-0" />
		{resumeError}
	</div>
{/if}
