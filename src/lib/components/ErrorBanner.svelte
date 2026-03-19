<script lang="ts">
	import type { SessionErrorInfo } from '$lib/shared/session-errors.js';
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
			(error.category === 'transient' || error.category === 'rate_limit')
	);
	let showSettingsLink = $derived(
		error.category === 'authentication' || error.category === 'billing'
	);
	let showStartNewSession = $derived(
		Boolean(onStartNewSession) && error.category === 'context_limit'
	);

	async function handleRetryClick() {
		try {
			await onRetry?.();
		} catch (err) {
			console.error('[session] Retry failed:', err);
		}
	}
</script>

<div
	class="bg-error-500/10 text-error-400 mt-2 flex flex-col items-center gap-2 rounded-md px-3 py-2 text-center text-[11px]"
>
	<div class="flex items-center justify-center gap-1.5">
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
		<span>{error.message}</span>
	</div>

	{#if showRetry || showSettingsLink || showStartNewSession}
		<div class="flex flex-wrap items-center justify-center gap-2">
			{#if showRetry}
				<button
					type="button"
					onclick={handleRetryClick}
					class="border-error-500/30 bg-error-500/10 hover:bg-error-500/20 rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors"
				>
					Retry
				</button>
			{/if}

			{#if showSettingsLink}
				<a
					href={resolve('/settings')}
					class="border-error-500/30 bg-error-500/10 hover:bg-error-500/20 rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors"
				>
					Configure API key in Settings
				</a>
			{/if}

			{#if showStartNewSession}
				<button
					type="button"
					onclick={onStartNewSession}
					class="border-error-500/30 bg-error-500/10 hover:bg-error-500/20 rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors"
				>
					Start new session in this project
				</button>
			{/if}
		</div>
	{/if}
</div>
