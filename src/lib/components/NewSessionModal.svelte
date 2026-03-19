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
	let useCustomPath = $state(false);
	let customPath = $state('');
	let permissionMode = $state<PermissionMode>(defaultPermissionMode);
	let selectedModel = $state(defaultModel);
	let isStarting = $state(false);
	let errorMessage = $state<string | null>(null);

	let dialogEl: HTMLDialogElement | undefined = $state();

	let hasTarget = $derived(useCustomPath ? customPath.trim() !== '' : selectedProject !== '');

	// Sync dialog open/close with store
	$effect(() => {
		if (!dialogEl) return;
		if (newSessionModal.open && !dialogEl.open) {
			// Initialize project selection on open
			if (!selectedProject && projects.length > 0) {
				selectedProject = projects[0].id;
			}
			// Default to custom path mode when no projects exist
			if (projects.length === 0) {
				useCustomPath = true;
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
			const payload: Record<string, unknown> = {
				prompt,
				permissionMode,
				model: selectedModel || undefined
			};
			if (useCustomPath) {
				payload.projectPath = customPath.trim();
			} else {
				payload.projectId = selectedProject;
			}

			const response = await fetch('/api/session/start', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			});

			const body = await response.json();
			if (!response.ok) {
				errorMessage = body.error ?? 'Failed to start session';
				return;
			}

			const resolvedProjectId = body.projectId ?? selectedProject;
			handleClose();
			await goto(resolve(`/session/${resolvedProjectId}/${body.sessionId}`), {
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

<dialog
	bind:this={dialogEl}
	onclose={handleClose}
	onclick={handleBackdropClick}
	class="bg-surface-950 border-surface-800 m-auto w-full max-w-xl rounded-2xl border p-0 shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
>
	<div class="p-6">
		<div class="mb-5 flex items-center justify-between">
			<h2 class="text-text-100 text-lg font-semibold">New Session</h2>
			<button
				onclick={handleClose}
				class="text-text-500 hover:text-text-300 cursor-pointer transition-colors"
				aria-label="Close"
			>
				<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
				</svg>
			</button>
		</div>

		<div class="space-y-4">
			<!-- Project selector -->
			<div>
				<div class="mb-1.5 flex items-center justify-between">
					<label
						for={useCustomPath ? 'modal-project-path' : 'modal-project-select'}
						class="text-text-300 text-xs font-medium"
						>{useCustomPath ? 'Project Directory' : 'Project'}</label
					>
					{#if projects.length > 0}
						<button
							type="button"
							onclick={() => (useCustomPath = !useCustomPath)}
							class="text-accent-400 hover:text-accent-300 cursor-pointer text-xs transition-colors"
						>
							{useCustomPath ? 'Select existing project' : 'Use custom path'}
						</button>
					{/if}
				</div>
				{#if useCustomPath || projects.length === 0}
					<input
						id="modal-project-path"
						type="text"
						bind:value={customPath}
						placeholder="/path/to/your/project"
						class="border-surface-800 bg-surface-900 text-text-100 placeholder:text-text-600 input-glow w-full rounded-md border px-3 py-2.5 text-sm outline-none"
					/>
					<p class="text-text-500 mt-1 text-xs">
						{#if projects.length === 0 && !useCustomPath}
							No existing projects found. Enter a project directory path to get started.
						{:else}
							Enter the absolute path to a local project directory.
						{/if}
					</p>
				{:else}
					<select
						id="modal-project-select"
						bind:value={selectedProject}
						class="border-surface-800 bg-surface-900 text-text-100 input-glow w-full rounded-md border px-3 py-2.5 text-sm outline-none"
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
						class="text-text-300 mb-1.5 block text-xs font-medium">Permission Mode</label
					>
					<select
						id="modal-permission-select"
						bind:value={permissionMode}
						class="border-surface-800 bg-surface-900 text-text-100 input-glow w-full rounded-md border px-3 py-2.5 text-sm outline-none"
					>
						{#each PERMISSION_MODES as mode (mode)}
							<option value={mode}>{PERMISSION_MODE_LABELS[mode]}</option>
						{/each}
					</select>
				</div>
				<div>
					<label for="modal-model-select" class="text-text-300 mb-1.5 block text-xs font-medium"
						>Model</label
					>
					<select
						id="modal-model-select"
						bind:value={selectedModel}
						class="border-surface-800 bg-surface-900 text-text-100 input-glow w-full rounded-md border px-3 py-2.5 text-sm outline-none"
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
			<div
				class="border-error-500/30 bg-error-500/10 text-error-400 mt-4 rounded-md border px-3 py-2 text-xs"
			>
				{errorMessage}
			</div>
		{/if}

		<!-- Composer -->
		<div class="mt-5">
			<Composer
				onSubmit={startSession}
				disabled={isStarting || !hasTarget}
				placeholder="Enter your prompt to start the session..."
				draftKey="new-session-modal-draft"
				buttonLabel="Start"
			/>
		</div>
	</div>
</dialog>
