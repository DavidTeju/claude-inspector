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

{#if isSubagent && parentSessionId}
	<a
		href={resolve(`/session/${projectId}/${parentSessionId}`)}
		class="btn btn-ghost btn-sm text-primary mb-1.5 inline-flex items-center gap-1.5"
	>
		<svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
			<path stroke-linecap="round" stroke-linejoin="round" d="M7 17L17 7M7 7h10v10" />
		</svg>
		Parent session
	</a>
{/if}

<div class="card bg-base-200 overflow-hidden rounded-xl">
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
			<span class="text-base-content min-w-0 truncate text-sm font-medium" title={sessionTitle}>
				{sessionTitle}
			</span>
		{/if}
		{#if isActive}
			<span class="text-base-content/50 shrink-0 text-xs">{currentLabel.label}</span>
			<button
				onclick={() => onInterrupt?.()}
				disabled={!canInterrupt}
				aria-label="Interrupt session"
				class="btn btn-error btn-sm btn-outline ml-auto"
			>
				<svg class="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
					<rect x="6" y="6" width="12" height="12" rx="1" />
				</svg>
				Stop
			</button>
		{:else}
			{#if messageCount > 0}
				<span class="text-base-content/50 text-xs"
					>&middot; {messageCount} msg{messageCount !== 1 ? 's' : ''}</span
				>
			{/if}
			{#if sessionId && showResumeCommand}
				<button
					onclick={copyResumeCommand}
					class="btn btn-ghost btn-xs ml-auto flex items-center gap-1.5"
					title="Copy resume command"
				>
					<code class="text-base-content/50 max-w-[10rem] truncate font-mono text-[10px]"
						>claude --resume {sessionId.slice(0, SESSION_ID_DISPLAY_LENGTH)}...</code
					>
					{#if copied}
						<svg
							class="text-success h-3.5 w-3.5"
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
		{/if}
	</div>

	<!-- Row 2: Metadata (active sessions only) -->
	{#if isActive}
		<div class="text-base-content/50 flex items-center gap-2 px-4 pb-2.5 text-xs">
			{#if messageCount > 0}
				<span>{messageCount} msg{messageCount !== 1 ? 's' : ''}</span>
				<span class="text-base-content/20">&middot;</span>
			{/if}

			<button
				onclick={cyclePermissionMode}
				aria-label="Cycle permission mode"
				class="btn btn-ghost btn-xs"
				title="Click to cycle permission mode"
			>
				{PERMISSION_MODE_LABELS[permissionMode] ?? permissionMode}
			</button>

			{#if model}
				<span class="text-base-content/20">&middot;</span>
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
	<div class="alert alert-warning mt-2 text-sm">
		<svg
			class="h-3.5 w-3.5 shrink-0"
			fill="none"
			viewBox="0 0 24 24"
			stroke="currentColor"
			stroke-width="2"
		>
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
			/>
		</svg>
		Reconnecting...
	</div>
{/if}

{#if error}
	<div class="alert alert-error mt-2 text-sm">
		<svg
			class="h-3.5 w-3.5 shrink-0"
			fill="none"
			viewBox="0 0 24 24"
			stroke="currentColor"
			stroke-width="2"
		>
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
			/>
		</svg>
		{error}
	</div>
{/if}

{#if resumeError}
	<div class="alert alert-error mt-2 text-sm">
		<svg
			class="h-3.5 w-3.5 shrink-0"
			fill="none"
			viewBox="0 0 24 24"
			stroke="currentColor"
			stroke-width="2"
		>
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
			/>
		</svg>
		{resumeError}
	</div>
{/if}
