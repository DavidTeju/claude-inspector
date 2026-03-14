<script lang="ts">
	import { codeToHtml } from 'shiki';
	import { theme } from '$lib/stores/theme.svelte.js';

	let { code, language = 'text' }: { code: string; language?: string } = $props();

	let highlightedHtml = $state('');
	let isLoading = $state(true);

	let shikiTheme = $derived(theme.resolved === 'dark' ? 'github-dark' : 'github-light');

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
		const currentTheme = shikiTheme;

		isLoading = true;
		codeToHtml(code, {
			lang,
			theme: currentTheme
		})
			.then((html) => {
				highlightedHtml = html;
				isLoading = false;
			})
			.catch(() => {
				// Fallback: try as plain text
				codeToHtml(code, { lang: 'text', theme: currentTheme })
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
	class="code-block group border-surface-800 bg-surface-950 relative my-2 overflow-hidden rounded-md border"
>
	<div class="border-surface-800/50 flex items-center justify-between border-b px-3 py-1">
		<span class="text-accent-400/50 font-sans text-[10px] tracking-wide uppercase">{language}</span>
	</div>

	<div class="overflow-x-auto p-3 text-[12px] leading-relaxed">
		{#if isLoading}
			<pre class="text-text-300 font-mono"><code>{code}</code></pre>
		{:else if highlightedHtml}
			{@html highlightedHtml}
		{:else}
			<pre class="text-text-300 font-mono"><code>{code}</code></pre>
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
