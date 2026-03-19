<script lang="ts">
	// eslint-disable-next-line import-x/no-duplicates
	import { cubicOut } from 'svelte/easing';
	// eslint-disable-next-line import-x/no-duplicates
	import { slide } from 'svelte/transition';
	import type { PermissionRequest } from '$lib/shared/active-session-types.js';

	const MAX_JSON_PREVIEW_LENGTH = 200;

	let {
		request,
		onAllow,
		onDeny
	}: {
		request: PermissionRequest;
		onAllow: (queuedNote?: string) => void;
		onDeny: (message: string) => void;
	} = $props();

	let openPanel = $state<'note' | 'deny' | null>(null);
	let noteText = $state('');
	let denyMessage = $state('');

	type ViewMode = 'read' | 'edit' | 'bash' | 'write' | 'glob' | 'grep' | 'generic';

	const VIEW_MODE_MAP: Record<string, ViewMode> = {
		read: 'read',
		edit: 'edit',
		bash: 'bash',
		write: 'write',
		glob: 'glob',
		grep: 'grep'
	};

	let viewMode = $derived<ViewMode>(VIEW_MODE_MAP[request.toolName.toLowerCase()] ?? 'generic');

	let inputPreview = $derived.by(() => {
		const input = request.input;
		switch (viewMode) {
			case 'bash':
				return { type: 'code' as const, value: String(input.command ?? '') };
			case 'read':
			case 'write':
			case 'edit':
				return { type: 'path' as const, value: String(input.file_path ?? '') };
			case 'glob':
			case 'grep':
				return { type: 'pattern' as const, value: String(input.pattern ?? '') };
			default: {
				const json = JSON.stringify(input, null, 2);
				return { type: 'json' as const, value: json, long: json.length > MAX_JSON_PREVIEW_LENGTH };
			}
		}
	});

	let jsonExpanded = $state(false);
</script>

<div class="animate-pulse-border bg-warning/5 rounded-xl border-l-2 px-4 py-3">
	<!-- Header -->
	<div class="mb-2 flex items-center gap-2">
		<span class="badge badge-warning badge-sm">
			{request.toolName}
		</span>
		{#if request.decisionReason}
			<span class="text-base-content/50 text-[10px]">{request.decisionReason}</span>
		{/if}
	</div>

	<!-- Input preview -->
	<div class="mb-3">
		{#if inputPreview.type === 'code'}
			<pre
				class="border-primary/20 bg-primary/5 text-primary overflow-auto rounded-md border p-2 font-mono text-[11px] leading-relaxed">{inputPreview.value}</pre>
		{:else if inputPreview.type === 'path'}
			<span class="text-base-content/70 font-mono text-[11px]">{inputPreview.value}</span>
		{:else if inputPreview.type === 'pattern'}
			<span
				class="border-primary/20 bg-primary/5 text-primary inline-block rounded border px-2 py-1 font-mono text-[11px]"
			>
				{inputPreview.value}
			</span>
		{:else if inputPreview.long && !jsonExpanded}
			<button onclick={() => (jsonExpanded = true)} class="btn btn-ghost btn-xs">
				Show input ({inputPreview.value.length} chars)
			</button>
		{:else}
			<pre
				class="bg-base-100 text-base-content/70 max-h-48 overflow-auto rounded-md p-2 font-mono text-[11px] leading-relaxed">{inputPreview.value}</pre>
		{/if}
	</div>

	<!-- Action buttons -->
	<div class="flex items-center gap-2">
		<button
			onclick={() => onAllow()}
			aria-label="Allow tool use"
			class="btn btn-success btn-sm btn-outline"
		>
			Allow
		</button>
		<button
			onclick={() => (openPanel = openPanel === 'note' ? null : 'note')}
			aria-label="Allow with note"
			class="btn btn-success btn-sm btn-ghost"
		>
			Allow + Note
		</button>
		<button
			onclick={() => (openPanel = openPanel === 'deny' ? null : 'deny')}
			aria-label="Deny tool use"
			class="btn btn-error btn-sm btn-outline"
		>
			Deny
		</button>
	</div>

	<!-- Note input -->
	{#if openPanel === 'note'}
		<div transition:slide={{ duration: 250, easing: cubicOut }} class="mt-3 space-y-2">
			<textarea
				bind:value={noteText}
				placeholder="Add a note for Claude (will be sent after this turn)..."
				rows="2"
				class="textarea textarea-bordered w-full"
			></textarea>
			<button
				onclick={() => {
					onAllow(noteText || undefined);
					noteText = '';
					openPanel = null;
				}}
				class="btn btn-success btn-sm"
			>
				Allow with note
			</button>
		</div>
	{/if}

	<!-- Deny input -->
	{#if openPanel === 'deny'}
		<div transition:slide={{ duration: 250, easing: cubicOut }} class="mt-3 space-y-2">
			<textarea
				bind:value={denyMessage}
				placeholder="Tell Claude what to do instead..."
				rows="2"
				class="textarea textarea-bordered w-full"
			></textarea>
			<button
				onclick={() => {
					onDeny(denyMessage || 'Denied by user');
					denyMessage = '';
					openPanel = null;
				}}
				class="btn btn-error btn-sm"
			>
				Deny
			</button>
		</div>
	{/if}
</div>
