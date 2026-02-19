<script lang="ts">
	import '../app.css';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import TopBar from '$lib/components/TopBar.svelte';

	let { data, children } = $props();
	let sidebarOpen = $state(true);
</script>

<div class="flex h-screen overflow-hidden">
	<Sidebar
		projects={data.projects}
		open={sidebarOpen}
		onToggle={() => (sidebarOpen = !sidebarOpen)}
	/>

	<div class="flex flex-1 flex-col overflow-hidden">
		<TopBar {sidebarOpen} onToggleSidebar={() => (sidebarOpen = !sidebarOpen)} />

		<main class="flex-1 overflow-y-auto p-6">
			{@render children()}
		</main>
	</div>
</div>
