import { spawn, type ChildProcess } from 'child_process';
import { readdir, readFile, stat } from 'fs/promises';
import path from 'path';
import { rgPath } from '@vscode/ripgrep';
import { getProjectsDir } from './paths.js';
import { dirNameToDisplayName } from './projects.js';
import type { SearchResult, SessionIndex } from '$lib/types.js';

/**
 * Extract text content from a parsed JSONL session record.
 * Only returns text from user/assistant messages.
 */
function extractTextContent(record: Record<string, unknown>): string | null {
	const type = record.type as string;
	if (type !== 'user' && type !== 'assistant') return null;

	const message = record.message as { content?: unknown } | undefined;
	if (!message?.content) return null;

	if (typeof message.content === 'string') {
		return message.content;
	}

	if (Array.isArray(message.content)) {
		const texts: string[] = [];
		for (const block of message.content) {
			if (
				block &&
				typeof block === 'object' &&
				'type' in block &&
				block.type === 'text' &&
				'text' in block &&
				typeof block.text === 'string'
			) {
				texts.push(block.text);
			}
		}
		return texts.length > 0 ? texts.join('\n') : null;
	}

	return null;
}

function createSnippet(text: string, term: string): string {
	const lower = text.toLowerCase();
	const termLower = term.toLowerCase();
	const idx = lower.indexOf(termLower);
	if (idx === -1) return text.slice(0, 150).replace(/\n/g, ' ');

	const start = Math.max(0, idx - 60);
	const end = Math.min(text.length, idx + term.length + 90);

	let snippet = text.slice(start, end).replace(/\n/g, ' ');
	if (start > 0) snippet = '...' + snippet;
	if (end < text.length) snippet = snippet + '...';

	return snippet;
}

// In-memory cache for session index data
const indexCache = new Map<string, { data: SessionIndex; timestamp: number }>();
const INDEX_CACHE_TTL = 5000;

async function loadSessionIndex(projectId: string): Promise<SessionIndex | null> {
	const now = Date.now();
	const cached = indexCache.get(projectId);
	if (cached && now - cached.timestamp < INDEX_CACHE_TTL) {
		return cached.data;
	}

	try {
		const indexPath = path.join(getProjectsDir(), projectId, 'sessions-index.json');
		const indexData: SessionIndex = JSON.parse(await readFile(indexPath, 'utf-8'));
		indexCache.set(projectId, { data: indexData, timestamp: now });
		return indexData;
	} catch {
		return null;
	}
}

async function loadSessionMeta(
	projectId: string,
	sessionId: string
): Promise<{
	summary: string;
	firstPrompt: string;
	messageCount: number;
	modified: string;
} | null> {
	const indexData = await loadSessionIndex(projectId);
	if (!indexData) return null;

	const entry = indexData.entries.find((e) => e.sessionId === sessionId);
	if (entry) {
		return {
			summary: entry.summary,
			firstPrompt: entry.firstPrompt,
			messageCount: entry.messageCount,
			modified: entry.modified
		};
	}
	return null;
}

export interface StreamingSearchCallbacks {
	onResult: (result: SearchResult) => void;
	onDone: (totalSessions: number) => void;
	onError: (error: string) => void;
}

/** A match that passed sync filtering, pending async enrichment */
interface PendingMatch {
	projectId: string;
	sessionId: string;
	snippet: string;
}

/**
 * Spawns rg to search JSONL files with full-text post-filtering.
 *
 * All filtering and dedup is fully synchronous in the stdout handler.
 * After rg closes, async metadata enrichment runs on the deduplicated set,
 * results are sorted by relevance, and emitted via callbacks.
 */
export function searchSessionsStreaming(
	query: string,
	callbacks: StreamingSearchCallbacks,
	projectFilter?: string
): ChildProcess | null {
	if (!query || query.trim().length < 2) {
		callbacks.onDone(0);
		return null;
	}

	const terms = query
		.toLowerCase()
		.split(/\s+/)
		.filter((t) => t.length > 1);
	if (terms.length === 0) {
		callbacks.onDone(0);
		return null;
	}

	const projectsDir = getProjectsDir();
	const searchPath = projectFilter ? path.join(projectsDir, projectFilter) : projectsDir;

	const rgArgs = [
		'--json',
		'--fixed-strings',
		'--ignore-case',
		'--max-count',
		'5',
		'--glob',
		'*.jsonl',
		terms[0],
		searchPath
	];

	let rgProcess: ChildProcess;
	try {
		rgProcess = spawn(rgPath, rgArgs);
	} catch {
		fallbackIndexSearch(query, projectFilter, callbacks);
		return null;
	}

	const seenSessions = new Set<string>();
	const pendingMatches: PendingMatch[] = [];
	let closed = false;

	const timeout = setTimeout(() => {
		rgProcess.kill();
	}, 10000);

	/**
	 * Process a single rg JSON match line. All work is synchronous.
	 * Returns a PendingMatch if it passes all filters, or null.
	 */
	function processSyncMatch(rgEvent: Record<string, unknown>): PendingMatch | null {
		if (rgEvent.type !== 'match') return null;

		const data = rgEvent.data as {
			path?: { text?: string };
			lines?: { text?: string };
		};
		const filePath = data?.path?.text;
		const lineText = data?.lines?.text;
		if (!filePath || !lineText) return null;

		// Extract projectId and sessionId from path
		const relPath = filePath.replace(projectsDir + '/', '');
		const parts = relPath.split('/');
		if (parts.length < 2) return null;
		// Skip subagent files (projectId/sessionId/subagents/agent-xxx.jsonl)
		if (parts.length > 2) return null;

		const projectId = parts[0];
		const sessionId = parts[1].replace('.jsonl', '');

		// Dedup — skip if already have a passing match for this session
		const key = `${projectId}/${sessionId}`;
		if (seenSessions.has(key)) return null;

		// Parse the JSONL record
		let record: Record<string, unknown>;
		try {
			record = JSON.parse(lineText);
		} catch {
			return null;
		}

		// Extract text content (only user/assistant messages)
		const textContent = extractTextContent(record);
		if (!textContent) return null;

		// Verify ALL terms appear in the text
		const lowerText = textContent.toLowerCase();
		if (!terms.every((t) => lowerText.includes(t))) return null;

		// Passed all filters — claim this session
		seenSessions.add(key);
		return {
			projectId,
			sessionId,
			snippet: createSnippet(textContent, terms[0])
		};
	}

	const chunks: Buffer[] = [];

	rgProcess.stdout?.on('data', (chunk: Buffer) => {
		chunks.push(chunk);
	});

	rgProcess.stderr?.on('data', () => {});

	rgProcess.on('close', () => {
		if (closed) return;
		closed = true;
		clearTimeout(timeout);

		// Parse all rg output at once — avoids buffer-split issues
		const fullOutput = Buffer.concat(chunks).toString('utf-8');
		const lines = fullOutput.split('\n');

		for (const line of lines) {
			if (!line.trim()) continue;
			if (pendingMatches.length >= 500) break;

			let rgEvent;
			try {
				rgEvent = JSON.parse(line);
			} catch {
				continue;
			}

			const match = processSyncMatch(rgEvent);
			if (match) pendingMatches.push(match);
		}

		// Async: enrich with metadata, sort by relevance, emit
		enrichAndEmit(pendingMatches, terms, callbacks);
	});

	rgProcess.on('error', () => {
		if (closed) return;
		closed = true;
		clearTimeout(timeout);
		fallbackIndexSearch(query, projectFilter, callbacks);
	});

	return rgProcess;
}

async function enrichAndEmit(
	matches: PendingMatch[],
	terms: string[],
	callbacks: StreamingSearchCallbacks
): Promise<void> {
	const results: SearchResult[] = [];

	await Promise.all(
		matches.map(async (match) => {
			const meta = await loadSessionMeta(match.projectId, match.sessionId);

			let modified = meta?.modified || '';
			if (!modified) {
				try {
					const filePath = path.join(
						getProjectsDir(),
						match.projectId,
						match.sessionId + '.jsonl'
					);
					const fileStat = await stat(filePath);
					modified = fileStat.mtime.toISOString();
				} catch {
					modified = new Date().toISOString();
				}
			}

			// Relevance: terms in firstPrompt/summary rank higher
			const summaryLower = (meta?.summary || '').toLowerCase();
			const promptLower = (meta?.firstPrompt || '').toLowerCase();
			let relevance = 0;
			for (const t of terms) {
				if (promptLower.includes(t)) relevance += 2;
				if (summaryLower.includes(t)) relevance += 1;
			}

			results.push({
				projectId: match.projectId,
				projectName: dirNameToDisplayName(match.projectId),
				sessionId: match.sessionId,
				sessionSummary: meta?.summary || '',
				firstPrompt: meta?.firstPrompt || '',
				snippets: [match.snippet],
				modified,
				relevance
			});
		})
	);

	// Sort: highest relevance first, then newest first
	results.sort((a, b) => {
		const ra = a.relevance ?? 0;
		const rb = b.relevance ?? 0;
		if (rb !== ra) return rb - ra;
		return new Date(b.modified).getTime() - new Date(a.modified).getTime();
	});

	for (const result of results) {
		callbacks.onResult(result);
	}

	callbacks.onDone(results.length);
}

async function fallbackIndexSearch(
	query: string,
	projectFilter: string | undefined,
	callbacks: StreamingSearchCallbacks
): Promise<void> {
	const terms = query
		.toLowerCase()
		.split(/\s+/)
		.filter((t) => t.length > 1);
	if (terms.length === 0) {
		callbacks.onDone(0);
		return;
	}

	const projectsDir = getProjectsDir();
	let projectDirs: string[];
	try {
		projectDirs = await readdir(projectsDir);
	} catch {
		callbacks.onDone(0);
		return;
	}

	if (projectFilter) {
		projectDirs = projectDirs.filter((d) => d === projectFilter);
	}

	let totalEmitted = 0;

	for (const projectDir of projectDirs) {
		try {
			const indexPath = path.join(projectsDir, projectDir, 'sessions-index.json');
			const indexData: SessionIndex = JSON.parse(await readFile(indexPath, 'utf-8'));

			for (const entry of indexData.entries) {
				const searchText = `${entry.firstPrompt} ${entry.summary}`.toLowerCase();
				if (!terms.every((t) => searchText.includes(t))) continue;

				const snippets: string[] = [];
				for (const term of terms.slice(0, 2)) {
					const s = createSnippet(searchText, term);
					if (s && !snippets.includes(s)) snippets.push(s);
				}

				callbacks.onResult({
					projectId: projectDir,
					projectName: dirNameToDisplayName(projectDir),
					sessionId: entry.sessionId,
					sessionSummary: entry.summary,
					firstPrompt: entry.firstPrompt,
					snippets,
					modified: entry.modified
				});
				totalEmitted++;

				if (totalEmitted >= 500) break;
			}
		} catch {
			continue;
		}

		if (totalEmitted >= 500) break;
	}

	callbacks.onDone(totalEmitted);
}

export async function searchSessions(
	query: string,
	projectFilter?: string
): Promise<SearchResult[]> {
	return new Promise((resolve) => {
		const results: SearchResult[] = [];

		const rgProcess = searchSessionsStreaming(
			query,
			{
				onResult: (result) => results.push(result),
				onDone: () => resolve(results),
				onError: () => resolve([])
			},
			projectFilter
		);

		if (!rgProcess) return;
	});
}
