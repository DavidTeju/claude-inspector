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

<!-- Compact system alert — intentionally distinct from message-thread elements -->
<div
	class="border-error-500/15 bg-error-500/5 mt-2 flex items-start gap-2.5 rounded-lg border px-3 py-2"
>
	<!-- Error icon -->
	<svg
		class="text-error-500 mt-0.5 h-3.5 w-3.5 shrink-0"
		aria-hidden="true"
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

	<!-- Content -->
	<div class="min-w-0 flex-1">
		<div class="flex flex-wrap items-baseline gap-x-1.5">
			<span class="text-error-500 text-[11px] font-semibold">
				{CATEGORY_LABELS[error.category]}
			</span>
			<span class="text-text-500 text-[11px]">&mdash;</span>
			<span class="text-text-300 text-[11px] leading-snug">{error.message}</span>
		</div>

		<!-- Inline actions -->
		{#if showRetry || showSettingsLink || showStartNewSession}
			<div class="mt-1.5 flex flex-wrap items-center gap-2">
				{#if showRetry}
					<button
						type="button"
						onclick={handleRetryClick}
						disabled={retrying}
						aria-label={retrying ? 'Retrying last prompt' : 'Retry last prompt'}
						class="text-error-500 hover:text-error-400 flex cursor-pointer items-center gap-1 text-[11px] font-medium underline decoration-current/30 underline-offset-2 transition-colors disabled:cursor-not-allowed disabled:opacity-40"
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
							Retry last prompt
						{/if}
					</button>
				{/if}

				{#if showSettingsLink}
					<a
						href={resolve('/settings')}
						class="text-error-500 hover:text-error-400 flex items-center gap-1 text-[11px] font-medium underline decoration-current/30 underline-offset-2 transition-colors"
					>
						Open Settings
					</a>
				{/if}

				{#if showStartNewSession}
					<button
						type="button"
						onclick={onStartNewSession}
						class="text-accent-400 hover:text-accent-300 flex cursor-pointer items-center gap-1 text-[11px] font-medium underline decoration-current/30 underline-offset-2 transition-colors"
					>
						Start new session
					</button>
				{/if}
			</div>
		{/if}
	</div>
</div>
