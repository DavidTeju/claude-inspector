<script lang="ts">
	import { fade } from 'svelte/transition';
</script>

<div class="flex flex-col items-center gap-3 py-6" transition:fade={{ duration: 200 }}>
	<div
		class="border-accent-500/25 bg-surface-900/80 relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-3xl border shadow-sm"
	>
		<div class="border-accent-400/15 absolute inset-1.5 rounded-[1.2rem] border"></div>
		<svg
			class="text-accent-300 h-10 w-10"
			viewBox="0 0 48 48"
			fill="none"
			stroke="currentColor"
			stroke-width="2.5"
			stroke-linecap="round"
			stroke-linejoin="round"
			aria-hidden="true"
		>
			<path d="M10,38 L24,6 L38,38 L24,30Z" />
			<circle cx="38" cy="8" r="1.5" fill="currentColor" stroke="none" />
			<line x1="38" y1="4" x2="38" y2="5.5" />
			<line x1="38" y1="10.5" x2="38" y2="12" />
			<line x1="34" y1="8" x2="35.5" y2="8" />
			<line x1="40.5" y1="8" x2="42" y2="8" />
		</svg>
	</div>

	<div class="flex flex-col items-center gap-1">
		<h1 class="text-text-100 text-3xl font-black tracking-tight">Sessionaut</h1>
		<p class="text-text-500 text-sm">Explore your Claude sessions</p>
	</div>
</div>
