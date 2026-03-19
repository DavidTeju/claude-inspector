<script lang="ts">
	import type { SessionErrorCategory, SessionErrorInfo } from '$lib/shared/session-errors.js';
	import { resolve } from '$app/paths';

	let {
		error,
		onRetry,
		onStartNewSession
	}: {
		error: SessionErrorInfo;
		onRetry?: () => void | Promise<void>;
		onStartNewSession?: () => void;
	} = $props();

	let showRetry = $derived(
		Boolean(onRetry) &&
			error.recoverable &&
			(error.category === 'transient' ||
				error.category === 'rate_limit' ||
				error.category === 'action')
	);
	let showSettingsLink = $derived(
		error.category === 'authentication' || error.category === 'billing'
	);
	let showStartNewSession = $derived(
		Boolean(onStartNewSession) && error.category === 'context_limit'
	);
	let hasActions = $derived(showRetry || showSettingsLink || showStartNewSession);

	const CATEGORY_LABELS: Record<SessionErrorCategory, string> = {
		transient: 'Recoverable Error',
		authentication: 'Authentication Error',
		billing: 'Billing Error',
		context_limit: 'Context Limit Reached',
		action: 'Action Failed',
		network: 'Network Error',
		rate_limit: 'Rate Limited',
		unknown: 'Error'
	};

	let retrying = $state(false);

	async function handleRetryClick() {
		retrying = true;
		try {
			await onRetry?.();
		} catch (err) {
			console.error('[session] Retry failed:', err);
		} finally {
			retrying = false;
		}
	}
</script>

<div class="border-l-error-500/60 bg-error-500/5 mt-2 rounded-xl border-l-2 px-4 py-3">
	<!-- Header -->
	<div class="mb-1.5 flex items-center gap-2">
		<span class="bg-error-500/10 text-error-400 rounded px-1.5 py-0.5 text-[10px] font-semibold">
			{CATEGORY_LABELS[error.category]}
		</span>
	</div>

	<!-- Message -->
	<p class="text-error-300 text-[12px] leading-relaxed">{error.message}</p>

	<!-- Actions -->
	{#if hasActions}
		<div class="mt-3 flex flex-wrap items-center gap-2">
			{#if showRetry}
				<button
					type="button"
					onclick={handleRetryClick}
					disabled={retrying}
					class="border-error-500/20 bg-error-500/10 text-error-400 hover:bg-error-500/20 flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40"
				>
					{#if retrying}
						<svg class="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
							<circle
								class="opacity-25"
								cx="12"
								cy="12"
								r="10"
								stroke="currentColor"
								stroke-width="4"
							/>
							<path
								class="opacity-75"
								fill="currentColor"
								d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
							/>
						</svg>
						Retrying…
					{:else}
						<svg
							class="h-3 w-3"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							stroke-width="2"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
							/>
						</svg>
						Retry last prompt
					{/if}
				</button>
			{/if}

			{#if showSettingsLink}
				<a
					href={resolve('/settings')}
					class="border-error-500/20 bg-error-500/10 text-error-400 hover:bg-error-500/20 flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11px] font-semibold transition-colors"
				>
					<svg
						class="h-3 w-3"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="2"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
						/>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
						/>
					</svg>
					Open Settings
				</a>
			{/if}

			{#if showStartNewSession}
				<button
					type="button"
					onclick={onStartNewSession}
					class="border-accent-500/20 bg-accent-500/10 text-accent-400 hover:bg-accent-500/20 flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11px] font-semibold transition-colors"
				>
					<svg
						class="h-3 w-3"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="2"
					>
						<path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
					</svg>
					Start new session
				</button>
			{/if}
		</div>
	{/if}
</div>
