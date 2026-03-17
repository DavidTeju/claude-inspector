<script lang="ts">
	import { marked } from 'marked';
	import CodeBlock from './CodeBlock.svelte';

	let { content }: { content: string } = $props();

	// Parse markdown and split into segments (text vs code blocks)
	interface Segment {
		type: 'html' | 'code';
		content: string;
		language?: string;
	}

	let segments = $derived.by((): Segment[] => {
		if (!content) return [];

		const result: Segment[] = [];
		// Match fenced code blocks
		const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
		let lastIndex = 0;
		let match;

		while ((match = codeBlockRegex.exec(content)) !== null) {
			// Text before code block
			if (match.index > lastIndex) {
				const textBefore = content.slice(lastIndex, match.index);
				if (textBefore.trim()) {
					result.push({
						type: 'html',
						content: marked.parse(textBefore, { async: false }) as string
					});
				}
			}

			// Code block
			result.push({
				type: 'code',
				language: match[1] || 'text',
				content: match[2].trimEnd()
			});

			lastIndex = match.index + match[0].length;
		}

		// Remaining text
		if (lastIndex < content.length) {
			const remaining = content.slice(lastIndex);
			if (remaining.trim()) {
				result.push({
					type: 'html',
					content: marked.parse(remaining, { async: false }) as string
				});
			}
		}

		return result;
	});
</script>

<div class="markdown-body">
	{#each segments as segment, i (i)}
		{#if segment.type === 'code'}
			<CodeBlock code={segment.content} language={segment.language || 'text'} />
		{:else}
			{@html segment.content}
		{/if}
	{/each}
</div>

<style>
	.markdown-body {
		overflow-wrap: anywhere;
	}
	.markdown-body :global(p) {
		margin-bottom: 0.5em;
		color: var(--color-text-300);
	}
	.markdown-body :global(p:last-child) {
		margin-bottom: 0;
	}
	.markdown-body :global(code) {
		background: var(--color-surface-800);
		padding: 0.125em 0.375em;
		border-radius: 0.25rem;
		font-size: 0.85em;
		color: var(--color-accent-300);
	}
	.markdown-body :global(pre code) {
		background: none;
		padding: 0;
	}
	.markdown-body :global(ul),
	.markdown-body :global(ol) {
		margin-left: 1.25em;
		margin-bottom: 0.5em;
	}
	.markdown-body :global(li) {
		margin-bottom: 0.25em;
	}
	.markdown-body :global(h1),
	.markdown-body :global(h2),
	.markdown-body :global(h3) {
		font-weight: 700;
		margin-top: 1em;
		margin-bottom: 0.5em;
		color: var(--color-text-100);
	}
	.markdown-body :global(h1) {
		font-size: 1.25em;
	}
	.markdown-body :global(h2) {
		font-size: 1.1em;
	}
	.markdown-body :global(h3) {
		font-size: 1em;
	}
	.markdown-body :global(a) {
		color: var(--color-accent-400);
		text-decoration: underline;
	}
	.markdown-body :global(blockquote) {
		border-left: 2px solid var(--color-surface-700);
		padding-left: 0.75em;
		color: var(--color-text-300);
		margin-bottom: 0.5em;
	}
	.markdown-body :global(strong) {
		color: var(--color-text-100);
		font-weight: 600;
	}
</style>
