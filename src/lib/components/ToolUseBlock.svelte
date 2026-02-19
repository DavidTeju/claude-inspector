<script lang="ts">
	let {
		tool
	}: {
		tool: {
			id: string;
			name: string;
			input: Record<string, unknown>;
			result?: string | Array<{ type: string; text?: string }>;
			isError?: boolean;
		};
	} = $props();

	let expanded = $state(false);

	function getToolSummary(): string {
		const input = tool.input;
		if (tool.name === 'Read' && input.file_path) return String(input.file_path);
		if (tool.name === 'Write' && input.file_path) return String(input.file_path);
		if (tool.name === 'Edit' && input.file_path) return String(input.file_path);
		if (tool.name === 'Bash' && input.command) return String(input.command).slice(0, 80);
		if (tool.name === 'Glob' && input.pattern) return String(input.pattern);
		if (tool.name === 'Grep' && input.pattern) return String(input.pattern);
		if (tool.name === 'Task' && input.description) return String(input.description);
		if (tool.name === 'WebFetch' && input.url) return String(input.url).slice(0, 60);
		if (tool.name === 'WebSearch' && input.query) return String(input.query);
		return '';
	}

	function getResultText(): string {
		if (!tool.result) return '(no result)';
		if (typeof tool.result === 'string') return tool.result;
		if (Array.isArray(tool.result)) {
			return tool.result
				.filter((b) => b.type === 'text' && b.text)
				.map((b) => b.text)
				.join('\n');
		}
		return JSON.stringify(tool.result, null, 2);
	}

	let summary = $derived(getToolSummary());
</script>

<div class="rounded-md border border-zinc-800/50 bg-zinc-950/50">
	<button
		onclick={() => (expanded = !expanded)}
		class="flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors hover:bg-zinc-800/30"
	>
		<svg
			class="h-3 w-3 flex-shrink-0 text-zinc-600 transition-transform {expanded ? 'rotate-90' : ''}"
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
			<span class="truncate text-zinc-500 font-mono text-[11px]">{summary}</span>
		{/if}

		{#if tool.isError}
			<span class="ml-auto text-[10px] text-error-500">error</span>
		{/if}
	</button>

	{#if expanded}
		<div class="border-t border-zinc-800/50 px-3 py-2 space-y-2">
			<!-- Input -->
			<div>
				<div class="mb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
					Input
				</div>
				<pre
					class="max-h-64 overflow-auto rounded bg-zinc-950 p-2 text-[11px] text-zinc-400 font-mono leading-relaxed">{JSON.stringify(
						tool.input,
						null,
						2
					)}</pre>
			</div>

			<!-- Result -->
			{#if tool.result !== undefined}
				<div>
					<div
						class="mb-1 text-[10px] font-semibold uppercase tracking-wider {tool.isError
							? 'text-error-500'
							: 'text-zinc-600'}"
					>
						{tool.isError ? 'Error' : 'Result'}
					</div>
					<pre
						class="max-h-96 overflow-auto rounded bg-zinc-950 p-2 text-[11px] {tool.isError
							? 'text-red-400'
							: 'text-zinc-400'} font-mono leading-relaxed whitespace-pre-wrap break-words">{getResultText()}</pre>
				</div>
			{/if}
		</div>
	{/if}
</div>
