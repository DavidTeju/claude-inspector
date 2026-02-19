<script lang="ts">
	import { codeToHtml } from 'shiki';

	let { code, language = 'text' }: { code: string; language?: string } = $props();

	let highlightedHtml = $state('');
	let isLoading = $state(true);

	// Map common language aliases
	const langMap: Record<string, string> = {
		js: 'javascript',
		ts: 'typescript',
		sh: 'bash',
		shell: 'bash',
		py: 'python',
		rb: 'ruby',
		yml: 'yaml',
		md: 'markdown',
		json5: 'json',
		jsonc: 'json',
		zsh: 'bash',
		dockerfile: 'docker'
	};

	$effect(() => {
		const lang = langMap[language] || language;

		codeToHtml(code, {
			lang,
			theme: 'github-dark'
		})
			.then((html) => {
				highlightedHtml = html;
				isLoading = false;
			})
			.catch(() => {
				// Fallback: try as plain text
				codeToHtml(code, { lang: 'text', theme: 'github-dark' })
					.then((html) => {
						highlightedHtml = html;
						isLoading = false;
					})
					.catch(() => {
						highlightedHtml = '';
						isLoading = false;
					});
			});
	});
</script>

<div
	class="code-block group relative my-2 rounded-md border border-zinc-800 bg-[#0d1117] overflow-hidden"
>
	<div class="flex items-center justify-between border-b border-zinc-800/50 px-3 py-1">
		<span class="text-[10px] text-zinc-600">{language}</span>
	</div>

	<div class="overflow-x-auto p-3 text-[12px] leading-relaxed">
		{#if isLoading}
			<pre class="text-zinc-400 font-mono"><code>{code}</code></pre>
		{:else if highlightedHtml}
			{@html highlightedHtml}
		{:else}
			<pre class="text-zinc-400 font-mono"><code>{code}</code></pre>
		{/if}
	</div>
</div>

<style>
	.code-block :global(pre) {
		margin: 0;
		background: transparent !important;
	}
	.code-block :global(code) {
		font-family: var(--font-mono);
		font-size: 12px;
		line-height: 1.6;
	}
</style>
