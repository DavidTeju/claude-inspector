<script lang="ts">
	import '../app.css';
	import '$lib/stores/theme.svelte.js';
	import NewSessionModal from '$lib/components/NewSessionModal.svelte';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import TopBar from '$lib/components/TopBar.svelte';
	import { newSessionModal } from '$lib/stores/new-session-modal.svelte.js';
	import { page } from '$app/state';

	let { data, children } = $props();

	const DEFAULT_INNER_WIDTH = 1200;
	const MOBILE_BREAKPOINT = 1024;

	let innerWidth = $state(DEFAULT_INNER_WIDTH);
	let isMobile = $derived(innerWidth < MOBILE_BREAKPOINT);

	// Track explicit user toggle — null means "use viewport default"
	let userSidebarChoice = $state<boolean | null>(null);

	// Reset user choice when viewport crosses the breakpoint.
	// Plain `let` (not $state) — intentionally a closure variable, not reactive state.
	let prevIsMobile: boolean | undefined;
	$effect.pre(() => {
		if (prevIsMobile !== undefined && isMobile !== prevIsMobile) {
			userSidebarChoice = null;
		}
		prevIsMobile = isMobile;
	});

	let sidebarOpen = $derived(userSidebarChoice ?? !isMobile);

	function toggleSidebar() {
		userSidebarChoice = !sidebarOpen;
	}

	// Close sidebar on navigation when mobile
	let lastPath = '';
	$effect(() => {
		const path = page.url?.pathname ?? '';
		if (lastPath && path !== lastPath && isMobile) {
			userSidebarChoice = false;
		}
		lastPath = path;
	});
</script>

<svelte:window bind:innerWidth />

<div class="flex h-screen overflow-hidden">
	<!-- Mobile overlay backdrop -->
	{#if isMobile && sidebarOpen}
		<button
			class="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm transition-opacity"
			onclick={() => (userSidebarChoice = false)}
			aria-label="Close sidebar"
			tabindex="-1"
		></button>
	{/if}

	<Sidebar
		projects={data.projects}
		activeSessions={data.activeSessions}
		open={sidebarOpen}
		onToggle={toggleSidebar}
		onNewSession={() => newSessionModal.show()}
	/>

	<div class="flex min-h-0 flex-1 flex-col overflow-hidden">
		<TopBar {sidebarOpen} onToggleSidebar={toggleSidebar} />

		<main
			class="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto p-5 md:p-6 lg:p-8"
		>
			{@render children()}
		</main>
	</div>
</div>

<NewSessionModal projects={data.projects} models={data.models} />
