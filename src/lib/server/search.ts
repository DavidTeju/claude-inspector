import { readdir, readFile } from 'fs/promises';
import path from 'path';
import { getProjectsDir } from './paths.js';
import { dirNameToDisplayName } from './projects.js';
import type { SearchResult, SessionIndex } from '$lib/types.js';

/**
 * Searches across all sessions using the reconciled session indexes.
 * Matches query terms against firstPrompt and summary fields.
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
			// No index for this project — skip
			continue;
		}
	}

	return results.sort((a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime());
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
