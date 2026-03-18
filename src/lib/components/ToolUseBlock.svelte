<script lang="ts">
	import type { TextContentBlock, ToolCall } from '$lib/types.js';
	import CollapsibleSection from './CollapsibleSection.svelte';
	import BashView from './tool-views/BashView.svelte';
	import EditView from './tool-views/EditView.svelte';
	import RawJsonView from './tool-views/RawJsonView.svelte';
	import ReadView from './tool-views/ReadView.svelte';
	import SearchView from './tool-views/SearchView.svelte';
	import WriteView from './tool-views/WriteView.svelte';

	const MAX_INLINE_LENGTH = 80;
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

<CollapsibleSection
	containerClass="border-l-accent-300/50 bg-surface-850/80 rounded-md border-l-2"
	buttonClass="hover:bg-surface-800/30 px-3 py-2"
	bodyClass="border-surface-800/50 space-y-2 border-t px-3 py-2"
>
	{#snippet header()}
		<span class="font-semibold {tool.result?.isError ? 'text-error-500' : 'text-accent-300'}">
			{tool.name}
		</span>

		{#if summary}
			<span class="text-text-500 truncate font-mono text-[11px]">{summary}</span>
		{/if}

		{#if tool.result?.isError}
			<span class="text-error-400 bg-error-500/10 ml-auto rounded-full px-2 py-0.5 text-[10px]"
				>error</span
			>
		{/if}
	{/snippet}

	<!-- Badges + Raw toggle -->
	<div class="flex items-center gap-2">
		{#if viewMode !== 'generic'}
			<button
				onclick={() => (showRaw = !showRaw)}
				class="text-text-500 hover:text-text-300 text-[10px] transition-colors"
			>
				{showRaw ? 'View formatted' : 'View raw'}
			</button>
		{/if}
		{#if viewMode === 'edit' && tool.input.replace_all}
			<span class="bg-accent-500/10 text-accent-300 rounded px-1.5 py-0.5 text-[9px] font-medium"
				>replace_all</span
			>
		{/if}
	</div>

	{#if showRaw || viewMode === 'generic'}
		<RawJsonView {tool} {resultText} />
	{:else if viewMode === 'read'}
		<ReadView {resultText} />
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
