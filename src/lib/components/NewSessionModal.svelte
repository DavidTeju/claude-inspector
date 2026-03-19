<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
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

	// Initialize project selection when dialog opens
	$effect(() => {
		if (newSessionModal.open && !selectedProject && projects.length > 0) {
			selectedProject = projects[0].id;
		}
	});

	function handleOpenChange(open: boolean) {
		if (!open) {
			handleClose();
		}
	}

	function handleClose() {
		newSessionModal.hide();
		errorMessage = null;
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

<Dialog.Root open={newSessionModal.open} onOpenChange={handleOpenChange}>
	<Dialog.Content class="gap-0 p-6 sm:max-w-xl">
		<Dialog.Header class="mb-5">
			<Dialog.Title class="text-lg font-semibold">New Session</Dialog.Title>
		</Dialog.Header>

		<div class="space-y-4">
			<!-- Project selector -->
			<div>
				<Label
					for="modal-project-select"
					class="text-muted-foreground mb-1.5 block text-xs font-medium">Project</Label
				>
				{#if projects.length === 0}
					<p
						class="text-muted-foreground border-border bg-muted rounded-md border px-3 py-2.5 text-sm"
					>
						No projects found. Start a Claude session in a project directory first.
					</p>
				{:else}
					<select
						id="modal-project-select"
						bind:value={selectedProject}
						class="border-border bg-muted text-foreground focus:border-primary/50 w-full rounded-md border px-3 py-2.5 text-sm outline-none"
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
					<Label
						for="modal-permission-select"
						class="text-muted-foreground mb-1.5 block text-xs font-medium">Permission Mode</Label
					>
					<select
						id="modal-permission-select"
						bind:value={permissionMode}
						class="border-border bg-muted text-foreground focus:border-primary/50 w-full rounded-md border px-3 py-2.5 text-sm outline-none"
					>
						{#each PERMISSION_MODES as mode (mode)}
							<option value={mode}>{PERMISSION_MODE_LABELS[mode]}</option>
						{/each}
					</select>
				</div>
				<div>
					<Label
						for="modal-model-select"
						class="text-muted-foreground mb-1.5 block text-xs font-medium">Model</Label
					>
					<select
						id="modal-model-select"
						bind:value={selectedModel}
						class="border-border bg-muted text-foreground focus:border-primary/50 w-full rounded-md border px-3 py-2.5 text-sm outline-none"
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
				class="border-destructive/30 bg-destructive/10 text-destructive mt-4 rounded-md border px-3 py-2 text-xs"
			>
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
	</Dialog.Content>
</Dialog.Root>
