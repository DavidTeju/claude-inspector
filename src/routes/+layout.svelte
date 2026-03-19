<script lang="ts">
	import '../app.css';
	import { ModeWatcher } from 'mode-watcher';
	import NewSessionModal from '$lib/components/NewSessionModal.svelte';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import TopBar from '$lib/components/TopBar.svelte';
	import * as SidebarUI from '$lib/components/ui/sidebar/index.js';
	import { newSessionModal } from '$lib/stores/new-session-modal.svelte.js';

	let { data, children } = $props();

	let sidebarOpen = $state(true);
</script>

<ModeWatcher />

<SidebarUI.Provider bind:open={sidebarOpen}>
	<SidebarUI.Root collapsible="icon" variant="sidebar">
		<Sidebar
			projects={data.projects}
			activeSessions={data.activeSessions}
			onNewSession={() => newSessionModal.show()}
		/>
	</SidebarUI.Root>

	<SidebarUI.Inset>
		<TopBar />

		<main
			class="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto p-5 md:p-6 lg:p-8"
		>
			{@render children()}
		</main>
	</SidebarUI.Inset>
</SidebarUI.Provider>

<NewSessionModal
	projects={data.projects}
	models={data.models}
	defaultPermissionMode={data.defaultPermissionMode}
	defaultModel={data.defaultModel}
/>
