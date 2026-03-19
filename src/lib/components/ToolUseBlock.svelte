<script lang="ts">
	import type { TextContentBlock, ToolCall } from '$lib/types.js';
	import CollapsibleSection from './CollapsibleSection.svelte';
	import BashView from './tool-views/BashView.svelte';
	import EditView from './tool-views/EditView.svelte';
	import RawJsonView from './tool-views/RawJsonView.svelte';
	import ReadView from './tool-views/ReadView.svelte';
	import SearchView from './tool-views/SearchView.svelte';
	import WriteView from './tool-views/WriteView.svelte';

	const MAX_INLINE_LENGTH = 120;
	const MAX_PREVIEW_LENGTH = 60;

	let { tool }: { tool: ToolCall } = $props();

	let showRaw = $state(false);

	type ViewMode = 'read' | 'edit' | 'bash' | 'write' | 'glob' | 'grep' | 'generic';

	let viewMode = $derived.by((): ViewMode => {
		const name = tool.name.toLowerCase();
		if (name === 'read') return 'read';
		if (name === 'edit') return 'edit';
		if (name === 'bash') return 'bash';
		if (name === 'write') return 'write';
		if (name === 'glob') return 'glob';
		if (name === 'grep') return 'grep';
		return 'generic';
	});

	let summary = $derived.by(() => {
		const input = tool.input;
		switch (viewMode) {
			case 'read':
			case 'write':
			case 'edit':
				return input.file_path ? String(input.file_path) : '';
			case 'bash':
				return input.command ? String(input.command).slice(0, MAX_INLINE_LENGTH) : '';
			case 'glob':
			case 'grep':
				return input.pattern ? String(input.pattern) : '';
			default: {
				if (input.description) return String(input.description);
				if (input.url) return String(input.url).slice(0, MAX_PREVIEW_LENGTH);
				if (input.query) return String(input.query);
				return '';
			}
		}
	});

	let resultText = $derived.by(() => {
		const content = tool.result?.content;
		if (!content) return '(no result)';
		if (typeof content === 'string') return content;
		if (Array.isArray(content)) {
			return content
				.filter((b): b is TextContentBlock => b.type === 'text')
				.map((b) => b.text)
				.join('\n');
		}
		return JSON.stringify(content, null, 2);
	});
</script>

<CollapsibleSection accentClass="border-l-primary/30" bodyClass="space-y-2">
	{#snippet header()}
		<span
			class="badge badge-sm {tool.result?.isError ? 'badge-error' : 'badge-primary badge-outline'}"
		>
			{tool.name}
		</span>

		{#if summary}
			<span class="text-base-content/50 truncate font-mono text-[11px]">{summary}</span>
		{/if}

		{#if tool.result?.isError}
			<span class="badge badge-error badge-sm ml-auto">error</span>
		{/if}
	{/snippet}

	<!-- Badges + Raw toggle -->
	<div class="flex items-center gap-2">
		{#if viewMode !== 'generic'}
			<button onclick={() => (showRaw = !showRaw)} class="btn btn-ghost btn-xs">
				{showRaw ? 'View formatted' : 'View raw'}
			</button>
		{/if}
		{#if viewMode === 'edit' && tool.input.replace_all}
			<span class="badge badge-primary badge-xs badge-outline">replace_all</span>
		{/if}
	</div>

	{#if showRaw || viewMode === 'generic'}
		<RawJsonView {tool} {resultText} />
	{:else if viewMode === 'read'}
		<ReadView {tool} {resultText} />
	{:else if viewMode === 'edit'}
		<EditView {tool} {resultText} />
	{:else if viewMode === 'write'}
		<WriteView {tool} {resultText} />
	{:else if viewMode === 'bash'}
		<BashView {tool} {resultText} />
	{:else if viewMode === 'glob' || viewMode === 'grep'}
		<SearchView {tool} {resultText} />
	{/if}
</CollapsibleSection>
