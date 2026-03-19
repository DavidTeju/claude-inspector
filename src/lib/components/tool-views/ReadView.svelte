<script lang="ts">
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
		rb: 'Ruby',
		css: 'CSS',
		html: 'HTML',
		json: 'JSON',
		yaml: 'YAML',
		yml: 'YAML',
		md: 'Markdown',
		toml: 'TOML',
		sh: 'Shell',
		bash: 'Shell',
		zsh: 'Shell',
		sql: 'SQL',
		vue: 'Vue',
		java: 'Java',
		kt: 'Kotlin',
		swift: 'Swift',
		c: 'C',
		cpp: 'C++',
		h: 'C/C++',
		cs: 'C#'
	};

	let langLabel = $derived.by(() => {
		if (!filePath) return '';
		const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
		return EXT_LANG_MAP[ext] ?? '';
	});

	// Strip `cat -n` style line number prefixes (e.g. "     1→content").
	// Note: ideally this gets fixed at the data layer (JSONL parser) so views
	// receive clean content. For now, stripping at the display layer.
	const CAT_N_PREFIX = /^ {0,5}\d+→/;
	let lines = $derived(resultText.split('\n').map((l) => l.replace(CAT_N_PREFIX, '')));
</script>

{#if filePath}
	<div class="bg-accent flex items-center gap-2 rounded-t-md px-3 py-1.5">
		<svg
			class="text-muted-foreground h-3.5 w-3.5 flex-shrink-0"
			fill="none"
			viewBox="0 0 24 24"
			stroke="currentColor"
			stroke-width="1.5"
		>
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
			/>
		</svg>
		<span class="text-foreground/80 truncate font-mono text-[10px]">{filePath}</span>
		{#if langLabel}
			<span
				class="bg-surface-700/50 text-muted-foreground ml-auto rounded px-1.5 py-0.5 font-mono text-[9px]"
				>{langLabel}</span
			>
		{/if}
	</div>
{/if}

<div
	class="bg-background max-h-96 overflow-auto font-mono text-[11px] leading-relaxed {filePath
		? 'rounded-b-md'
		: 'rounded-md'}"
>
	{#each lines as line, i (i)}
		<div class="text-foreground/80 flex">
			<span
				class="border-border text-muted-foreground/50 w-10 flex-shrink-0 border-r pr-1 text-right select-none"
				>{i + 1}</span
			>
			<span class="pl-2 break-words whitespace-pre-wrap">{line}</span>
		</div>
	{/each}
</div>
