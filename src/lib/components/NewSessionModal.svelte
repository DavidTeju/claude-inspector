<script lang="ts">
	import type { PermissionMode } from '$lib/shared/active-session-types.js';
	import type { ModelOption } from '$lib/shared/models.js';
	import { PERMISSION_MODES, PERMISSION_MODE_LABELS } from '$lib/shared/permission-modes.js';
	import { newSessionModal } from '$lib/stores/new-session-modal.svelte.js';
	import type { Project } from '$lib/types.js';
	import { getErrorMessage } from '$lib/utils.js';
	import Composer from './Composer.svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';

	let {
		projects,
		models,
		defaultPermissionMode = 'default',
		defaultModel = ''
	}: {
		projects: Project[];
		models: ModelOption[];
		defaultPermissionMode?: PermissionMode;
		defaultModel?: string;
	} = $props();

	let selectedProject = $state('');
	let permissionMode = $state<PermissionMode>(defaultPermissionMode);
	let selectedModel = $state(defaultModel);
	let isStarting = $state(false);
	let errorMessage = $state<string | null>(null);

	let dialogEl: HTMLDialogElement | undefined = $state();

	// Sync dialog open/close with store
	$effect(() => {
		if (!dialogEl) return;
		if (newSessionModal.open && !dialogEl.open) {
			// Initialize project selection on open
			if (!selectedProject && projects.length > 0) {
				selectedProject = projects[0].id;
			}
			dialogEl.showModal();
		} else if (!newSessionModal.open && dialogEl.open) {
			dialogEl.close();
		}
	});

	function handleClose() {
		newSessionModal.hide();
		errorMessage = null;
	}

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === dialogEl) {
			handleClose();
		}
	}

	async function startSession(prompt: string) {
		isStarting = true;
		errorMessage = null;

		try {
			const response = await fetch('/api/session/start', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					projectId: selectedProject,
					prompt,
					permissionMode,
					model: selectedModel || undefined
				})
			});

			const body = await response.json();
			if (!response.ok) {
				errorMessage = body.error ?? 'Failed to start session';
				return;
			}

			handleClose();
			await goto(resolve(`/session/${selectedProject}/${body.sessionId}`), {
				invalidate: ['app:active-sessions']
			});
		} catch (err: unknown) {
			console.error('[session] Start failed:', err);
			errorMessage = `Failed to start session: ${getErrorMessage(err)}`;
		} finally {
			isStarting = false;
		}
	}
</script>

<dialog bind:this={dialogEl} onclose={handleClose} onclick={handleBackdropClick} class="modal">
	<div class="modal-box bg-base-100 border-base-content/10 w-full max-w-xl border">
		<div class="mb-5 flex items-center justify-between">
			<h2 class="text-base-content text-lg font-semibold">New Session</h2>
			<button onclick={handleClose} class="btn btn-ghost btn-circle btn-sm" aria-label="Close">
				<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
				</svg>
			</button>
		</div>

		<div class="space-y-4">
			<!-- Project selector -->
			<div>
				<label
					for="modal-project-select"
					class="text-base-content/70 mb-1.5 block text-xs font-medium">Project</label
				>
				{#if projects.length === 0}
					<p
						class="border-base-content/10 bg-base-200 text-base-content/50 rounded-md border px-3 py-2.5 text-sm"
					>
						No projects found. Start a Claude session in a project directory first.
					</p>
				{:else}
					<select
						id="modal-project-select"
						bind:value={selectedProject}
						class="select select-bordered select-sm w-full"
					>
						{#each projects as project (project.id)}
							<option value={project.id}>{project.displayName}</option>
						{/each}
					</select>
				{/if}
			</div>

			<!-- Permission mode + Model in a row -->
			<div class="grid grid-cols-2 gap-3">
				<div>
					<label
						for="modal-permission-select"
						class="text-base-content/70 mb-1.5 block text-xs font-medium">Permission Mode</label
					>
					<select
						id="modal-permission-select"
						bind:value={permissionMode}
						class="select select-bordered select-sm w-full"
					>
						{#each PERMISSION_MODES as mode (mode)}
							<option value={mode}>{PERMISSION_MODE_LABELS[mode]}</option>
						{/each}
					</select>
				</div>
				<div>
					<label
						for="modal-model-select"
						class="text-base-content/70 mb-1.5 block text-xs font-medium">Model</label
					>
					<select
						id="modal-model-select"
						bind:value={selectedModel}
						class="select select-bordered select-sm w-full"
					>
						{#each models as modelOption (modelOption.value)}
							<option value={modelOption.value}>{modelOption.displayName}</option>
						{/each}
					</select>
				</div>
			</div>
		</div>

		<!-- Error banner -->
		{#if errorMessage}
			<div class="alert alert-error mt-4 text-xs">
				{errorMessage}
			</div>
		{/if}

		<!-- Composer -->
		<div class="mt-5">
			<Composer
				onSubmit={startSession}
				disabled={isStarting || !selectedProject}
				placeholder="Enter your prompt to start the session..."
				draftKey="new-session-modal-draft"
				buttonLabel="Start"
			/>
		</div>
	</div>
	<form method="dialog" class="modal-backdrop">
		<button>close</button>
	</form>
</dialog>
