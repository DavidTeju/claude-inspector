<script lang="ts">
	import { FileText } from '@lucide/svelte';
	import type { ToolCall } from '$lib/types.js';

	let { tool, resultText }: { tool: ToolCall; resultText: string } = $props();

	let filePath = $derived(typeof tool.input.file_path === 'string' ? tool.input.file_path : '');

	const EXT_LANG_MAP: Record<string, string> = {
		ts: 'TypeScript',
		tsx: 'TSX',
		js: 'JavaScript',
		jsx: 'JSX',
		svelte: 'Svelte',
		py: 'Python',
		rs: 'Rust',
		go: 'Go',
		css: 'CSS',
		html: 'HTML',
		json: 'JSON',
		yaml: 'YAML',
		yml: 'YAML',
		md: 'Markdown',
		sh: 'Shell'
	};

	let langLabel = $derived.by(() => {
		if (!filePath) return '';
		const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
		return EXT_LANG_MAP[ext] ?? '';
	});

	let contentLines = $derived(
		typeof tool.input.content === 'string' ? tool.input.content.split('\n') : []
	);
</script>

{#if filePath}
	<div class="bg-surface-800 flex items-center gap-2 rounded-t-md px-3 py-1.5">
		<FileText class="text-text-500 h-3.5 w-3.5 flex-shrink-0" stroke-width="1.5" />
		<span class="text-text-300 truncate font-mono text-[10px]">{filePath}</span>
		{#if langLabel}
			<span
				class="bg-surface-700/50 text-text-500 ml-auto rounded px-1.5 py-0.5 font-mono text-[9px]"
				>{langLabel}</span
			>
		{/if}
	</div>
{/if}

{#if contentLines.length > 0}
	<div
		class="bg-surface-950 max-h-96 overflow-auto font-mono text-[11px] leading-relaxed {filePath
			? 'rounded-b-md'
			: 'rounded-md'}"
	>
		{#each contentLines as line, i (i)}
			<div class="text-text-300 flex">
				<span
					class="border-surface-800 text-text-700 w-10 flex-shrink-0 border-r pr-1 text-right select-none"
					>{i + 1}</span
				>
				<span class="pl-2 break-words whitespace-pre-wrap">{line}</span>
			</div>
		{/each}
	</div>
{/if}
{#if tool.result?.isError}
	<pre class="text-error-400 mt-1 text-[11px] break-words whitespace-pre-wrap">{resultText}</pre>
{/if}
