<script lang="ts">
	import { diffLines } from 'diff';
	// eslint-disable-next-line import-x/no-duplicates
	import { cubicOut } from 'svelte/easing';
	// eslint-disable-next-line import-x/no-duplicates
	import { slide } from 'svelte/transition';
	import type { ToolCall } from '$lib/types.js';

	const MAX_INLINE_LENGTH = 80;
	const MAX_PREVIEW_LENGTH = 60;

	let { tool }: { tool: ToolCall } = $props();

	let expanded = $state(false);
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
		if (!tool.result) return '(no result)';
		if (typeof tool.result === 'string') return tool.result;
		if (Array.isArray(tool.result)) {
			return tool.result
				.filter((b) => b.type === 'text' && b.text)
				.map((b) => b.text)
				.join('\n');
		}
		return JSON.stringify(tool.result, null, 2);
	});

	let editDiff = $derived.by(() => {
		if (viewMode !== 'edit') return [];
		const oldStr = tool.input.old_string;
		const newStr = tool.input.new_string;
		if (typeof oldStr !== 'string' || typeof newStr !== 'string') return [];
		return diffLines(oldStr, newStr);
	});
</script>

<div class="border-l-accent-300/50 bg-surface-850/80 rounded-md border-l-2">
	<button
		onclick={() => (expanded = !expanded)}
		class="hover:bg-surface-800/30 flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors"
	>
		<svg
			class="text-text-500 h-3 w-3 flex-shrink-0 transition-transform duration-200 {expanded
				? 'rotate-90'
				: ''}"
			fill="none"
			viewBox="0 0 24 24"
			stroke="currentColor"
			stroke-width="2"
		>
			<path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
		</svg>

		<span class="font-semibold {tool.isError ? 'text-error-500' : 'text-accent-300'}">
			{tool.name}
		</span>

		{#if summary}
			<span class="text-text-500 truncate font-mono text-[11px]">{summary}</span>
		{/if}

		{#if tool.isError}
			<span class="text-error-400 bg-error-500/10 ml-auto rounded-full px-2 py-0.5 text-[10px]"
				>error</span
			>
		{/if}
	</button>

	{#if expanded}
		<div
			transition:slide={{ duration: 250, easing: cubicOut }}
			class="border-surface-800/50 space-y-2 border-t px-3 py-2"
		>
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
					<span
						class="bg-accent-500/10 text-accent-300 rounded px-1.5 py-0.5 text-[9px] font-medium"
						>replace_all</span
					>
				{/if}
			</div>

			{#if showRaw || viewMode === 'generic'}
				<!-- Raw JSON view -->
				<div>
					<div class="text-text-500 mb-1 text-[10px] font-semibold tracking-wider uppercase">
						Input
					</div>
					<pre
						class="bg-surface-950 text-text-300 max-h-64 overflow-auto rounded-md p-2 font-mono text-[11px] leading-relaxed break-words whitespace-pre-wrap">{JSON.stringify(
							tool.input,
							null,
							2
						)}</pre>
				</div>

				{#if tool.result !== undefined}
					<div>
						<div
							class="mb-1 text-[10px] font-semibold tracking-wider uppercase {tool.isError
								? 'text-error-500'
								: 'text-text-500'}"
						>
							{tool.isError ? 'Error' : 'Result'}
						</div>
						<pre
							class="bg-surface-950 max-h-96 overflow-auto rounded-md p-2 text-[11px] {tool.isError
								? 'text-error-400'
								: 'text-text-300'} font-mono leading-relaxed break-words whitespace-pre-wrap">{resultText}</pre>
					</div>
				{/if}
			{:else if viewMode === 'read'}
				<!-- Read: show file content from result -->
				<pre
					class="bg-surface-950 text-text-300 max-h-96 overflow-auto rounded-md p-2 font-mono text-[11px] leading-relaxed break-words whitespace-pre-wrap">{resultText}</pre>
			{:else if viewMode === 'edit'}
				<!-- Edit: show diff -->
				{#if editDiff.length > 0}
					<div class="bg-surface-950 max-h-96 overflow-auto rounded-md font-mono text-[11px]">
						{#each editDiff as change, ci (ci)}
							{@const lines = change.value.replace(/\n$/, '').split('\n')}
							{#each lines as line, li (li)}
								{#if change.removed}
									<div class="bg-error-500/10 text-error-400 flex">
										<span class="text-error-400/50 w-6 flex-shrink-0 pr-1 text-right select-none"
											>&minus;</span
										>
										<span class="pl-1 break-words whitespace-pre-wrap">{line}</span>
									</div>
								{:else if change.added}
									<div class="bg-success-500/10 text-success-500 flex">
										<span class="text-success-500/50 w-6 flex-shrink-0 pr-1 text-right select-none"
											>+</span
										>
										<span class="pl-1 break-words whitespace-pre-wrap">{line}</span>
									</div>
								{:else}
									<div class="text-text-500 flex">
										<span class="text-text-700 w-6 flex-shrink-0 pr-1 text-right select-none"
											>&nbsp;</span
										>
										<span class="pl-1 break-words whitespace-pre-wrap">{line}</span>
									</div>
								{/if}
							{/each}
						{/each}
					</div>
				{:else}
					<pre
						class="bg-surface-950 text-text-300 max-h-64 overflow-auto rounded-md p-2 font-mono text-[11px] leading-relaxed break-words whitespace-pre-wrap">{JSON.stringify(
							tool.input,
							null,
							2
						)}</pre>
				{/if}

				{#if tool.isError && tool.result !== undefined}
					<pre
						class="text-error-400 mt-1 text-[11px] break-words whitespace-pre-wrap">{resultText}</pre>
				{/if}
			{:else if viewMode === 'write'}
				<!-- Write: show file content preview -->
				{#if typeof tool.input.content === 'string'}
					<pre
						class="bg-surface-950 text-text-300 max-h-96 overflow-auto rounded-md p-2 font-mono text-[11px] leading-relaxed break-words whitespace-pre-wrap">{tool
							.input.content}</pre>
				{/if}
				{#if tool.isError && tool.result !== undefined}
					<pre
						class="text-error-400 mt-1 text-[11px] break-words whitespace-pre-wrap">{resultText}</pre>
				{/if}
			{:else if viewMode === 'bash'}
				<!-- Bash: show command + output -->
				{#if typeof tool.input.command === 'string'}
					<pre
						class="bg-accent-500/5 border-accent-500/20 text-accent-300 max-h-32 overflow-auto rounded-md border p-2 font-mono text-[11px] leading-relaxed break-words whitespace-pre-wrap">{tool
							.input.command}</pre>
				{/if}
				{#if tool.result !== undefined}
					<pre
						class="bg-surface-950 max-h-96 overflow-auto rounded-md p-2 text-[11px] {tool.isError
							? 'text-error-400'
							: 'text-text-300'} font-mono leading-relaxed break-words whitespace-pre-wrap">{resultText}</pre>
				{/if}
			{:else if viewMode === 'glob' || viewMode === 'grep'}
				<!-- Glob/Grep: show pattern + matches -->
				<div class="flex items-center gap-2">
					{#if typeof tool.input.pattern === 'string'}
						<pre
							class="bg-accent-500/5 border-accent-500/20 text-accent-300 inline-block rounded border px-2 py-1 font-mono text-[11px] break-words whitespace-pre-wrap">{tool
								.input.pattern}</pre>
					{/if}
					{#if tool.input.path}
						<span class="text-text-500 font-mono text-[10px]">in {tool.input.path}</span>
					{/if}
				</div>
				{#if tool.result !== undefined}
					<pre
						class="bg-surface-950 text-text-300 max-h-96 overflow-auto rounded-md p-2 font-mono text-[11px] leading-relaxed break-words whitespace-pre-wrap">{resultText}</pre>
				{/if}
			{/if}
		</div>
	{/if}
</div>
