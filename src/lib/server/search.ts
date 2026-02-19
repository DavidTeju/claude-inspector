import { readdir, readFile } from 'fs/promises';
import { createReadStream } from 'fs';
import { createInterface } from 'readline';
import path from 'path';
import { getProjectsDir } from './paths.js';
import { dirNameToDisplayName } from './projects.js';
import type { SearchResult, SessionIndex, ContentBlock } from '$lib/types.js';

/**
 * Searches across all sessions for the given query terms.
 * Two-phase approach: first searches session index metadata (fast), then scans
 * JSONL file contents for sessions not already matched. Returns results with context snippets.
 */
export async function searchSessions(
	query: string,
	projectFilter?: string
): Promise<SearchResult[]> {
	if (!query || query.trim().length < 2) return [];

	const terms = query
		.toLowerCase()
		.split(/\s+/)
		.filter((t) => t.length > 1);
	if (terms.length === 0) return [];

	const projectsDir = getProjectsDir();
	let projectDirs: string[];

	try {
		projectDirs = await readdir(projectsDir);
	} catch {
		return [];
	}

	if (projectFilter) {
		projectDirs = projectDirs.filter((d) => d === projectFilter);
	}

	const results: SearchResult[] = [];

	for (const projectDir of projectDirs) {
		const fullProjectDir = path.join(projectsDir, projectDir);

		// Phase 1: Search session index metadata (fast)
		try {
			const indexPath = path.join(fullProjectDir, 'sessions-index.json');
			const indexData: SessionIndex = JSON.parse(await readFile(indexPath, 'utf-8'));

			for (const entry of indexData.entries) {
				const searchText = `${entry.firstPrompt} ${entry.summary}`.toLowerCase();
				const matches = terms.every((t) => searchText.includes(t));

				if (matches) {
					results.push({
						projectId: projectDir,
						projectName: dirNameToDisplayName(projectDir),
						sessionId: entry.sessionId,
						sessionSummary: entry.summary,
						firstPrompt: entry.firstPrompt,
						snippets: extractSnippets(searchText, terms),
						modified: entry.modified
					});
				}
			}
		} catch {
			// No index, fall through to JSONL scan
		}

		// Phase 2: Search JSONL content (slower but more thorough)
		try {
			const files = (await readdir(fullProjectDir)).filter((f) => f.endsWith('.jsonl'));

			for (const file of files) {
				const sessionId = file.replace('.jsonl', '');

				// Skip if already found in index search
				if (results.some((r) => r.sessionId === sessionId && r.projectId === projectDir)) {
					continue;
				}

				const filePath = path.join(fullProjectDir, file);
				const match = await searchJsonlFile(filePath, terms);

				if (match) {
					results.push({
						projectId: projectDir,
						projectName: dirNameToDisplayName(projectDir),
						sessionId,
						sessionSummary: match.summary,
						firstPrompt: match.firstPrompt,
						snippets: match.snippets,
						modified: match.modified
					});
				}
			}
		} catch {
			continue;
		}
	}

	return results.sort((a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime());
}

async function searchJsonlFile(
	filePath: string,
	terms: string[]
): Promise<{ summary: string; firstPrompt: string; snippets: string[]; modified: string } | null> {
	const rl = createInterface({
		input: createReadStream(filePath),
		crlfDelay: Infinity
	});

	let firstPrompt = '';
	let modified = '';
	const snippets: string[] = [];
	let found = false;

	for await (const line of rl) {
		try {
			const record = JSON.parse(line);

			if (record.type === 'user' && !firstPrompt && record.message?.content) {
				const content = record.message.content;
				if (typeof content === 'string') {
					firstPrompt = content.slice(0, 200);
				} else if (Array.isArray(content)) {
					const textBlock = content.find((b: ContentBlock) => b.type === 'text');
					if (textBlock?.text) {
						firstPrompt = textBlock.text.slice(0, 200);
					}
				}
			}

			if (record.timestamp) {
				modified = record.timestamp;
			}

			if ((record.type === 'user' || record.type === 'assistant') && record.message?.content) {
				const text = extractText(record.message.content);
				const lower = text.toLowerCase();

				if (terms.every((t) => lower.includes(t))) {
					found = true;
					if (snippets.length < 3) {
						snippets.push(createSnippet(text, terms[0]));
					}
				}
			}
		} catch {
			continue;
		}
	}

	if (!found) return null;

	return { summary: '', firstPrompt, snippets, modified };
}

function extractText(content: string | ContentBlock[]): string {
	if (typeof content === 'string') return content;
	if (!Array.isArray(content)) return '';

	return content
		.filter((b) => b.type === 'text' && b.text)
		.map((b) => b.text ?? '')
		.join(' ');
}

function createSnippet(text: string, term: string): string {
	const lower = text.toLowerCase();
	const idx = lower.indexOf(term);
	if (idx === -1) return text.slice(0, 150);

	const start = Math.max(0, idx - 60);
	const end = Math.min(text.length, idx + term.length + 90);

	let snippet = text.slice(start, end).replace(/\n/g, ' ');
	if (start > 0) snippet = '...' + snippet;
	if (end < text.length) snippet = snippet + '...';

	return snippet;
}

function extractSnippets(text: string, terms: string[]): string[] {
	const snippets: string[] = [];
	for (const term of terms.slice(0, 2)) {
		const snippet = createSnippet(text, term);
		if (snippet && !snippets.includes(snippet)) {
			snippets.push(snippet);
		}
	}
	return snippets;
}
