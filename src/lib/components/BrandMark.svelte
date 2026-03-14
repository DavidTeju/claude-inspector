<script lang="ts">
	let { compact = false }: { compact?: boolean } = $props();
</script>

<div class="flex items-center gap-3 leading-none">
	<div
		class="border-accent-500/25 bg-surface-900/80 relative flex items-center justify-center overflow-hidden rounded-2xl border shadow-sm {compact
			? 'h-10 w-10'
			: 'h-11 w-11'}"
	>
		<div class="border-accent-400/15 absolute inset-1 rounded-[0.9rem] border"></div>
		<svg
			class="text-accent-300 {compact ? 'h-6 w-6' : 'h-7 w-7'}"
			viewBox="0 0 48 48"
			fill="none"
			aria-hidden="true"
		>
			<path
				d="M27 13H21C16.582 13 13 16.582 13 21V27C13 31.418 16.582 35 21 35H27"
				stroke="currentColor"
				stroke-width="3.25"
				stroke-linecap="round"
				stroke-linejoin="round"
			/>
			<path d="M31 14V34" stroke="currentColor" stroke-width="3.25" stroke-linecap="round" />
			<circle cx="31" cy="9.5" r="2.5" fill="currentColor" opacity="0.9" />
		</svg>
	</div>

	<div class="flex min-w-0 flex-col">
		<span
			class="text-accent-300/80 font-semibold uppercase {compact
				? 'text-[0.55rem] tracking-[0.32em]'
				: 'text-[0.6rem] tracking-[0.36em]'}">Claude</span
		>
		<span
			class="text-text-100 truncate font-black uppercase italic {compact
				? 'text-[0.98rem] tracking-[0.14em]'
				: 'text-[1.08rem] tracking-[0.18em]'}">Inspector</span
		>
	</div>
</div>
