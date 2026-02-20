import { spawn, type ChildProcess } from 'child_process';
import { readdir, readFile, stat } from 'fs/promises';
import path from 'path';
import { rgPath } from '@vscode/ripgrep';
import { getProjectsDir } from './paths.js';
import { dirNameToDisplayName } from './projects.js';
import type { SearchResult, SessionIndex } from '$lib/types.js';

interface RgMatch {
	projectId: string;
	sessionId: string;
	lineText: string;
}

/**
 * Extract text content from a parsed JSONL session record.
 * Only returns text from user/assistant messages, filtering out tool_use, tool_result, thinking, etc.
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

/**
 * Create a context snippet around the match position in the extracted text.
 */
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

// In-memory cache for session index data to avoid re-reading the same file
const indexCache = new Map<string, { data: SessionIndex; timestamp: number }>();
const INDEX_CACHE_TTL = 5000; // 5 seconds

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

/**
 * Load session metadata from sessions-index.json for enrichment.
 */
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

/**
 * Spawns rg to search JSONL files, post-filters to actual message text,
 * and streams results via callbacks. Returns the child process for abort control.
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
		terms[0], // search for first term via rg, post-filter remaining terms
		searchPath
	];

	let rgProcess: ChildProcess;
	try {
		rgProcess = spawn(rgPath, rgArgs);
	} catch {
		// rg binary missing — fall back to index-only search
		fallbackIndexSearch(query, projectFilter, callbacks);
		return null;
	}

	// Dedup set shared with processMatch — checked AFTER sync filtering, BEFORE async enrichment.
	// Since async functions run synchronously until the first await, and the for loop in the
	// data handler calls them sequentially, the has()+add() in processMatch is atomic.
	const emittedSessions = new Set<string>();
	let totalEmitted = 0;
	let closed = false;

	const pendingPromises: Promise<void>[] = [];
	// Collect all stdout chunks — rg --json produces multi-MB lines for large
	// JSONL records, and Node's data events split these at arbitrary byte
	// boundaries. Incremental line parsing silently drops split lines.
	const stdoutChunks: Buffer[] = [];

	const timeout = setTimeout(() => {
		rgProcess.kill();
	}, 10000);

	rgProcess.stdout?.on('data', (chunk: Buffer) => {
		stdoutChunks.push(chunk);
	});

	rgProcess.stderr?.on('data', () => {});

	rgProcess.on('close', () => {
		if (closed) return;
		closed = true;
		clearTimeout(timeout);

		const fullOutput = Buffer.concat(stdoutChunks).toString('utf-8');
		const lines = fullOutput.split('\n');

		for (const line of lines) {
			if (!line.trim()) continue;
			if (emittedSessions.size >= 500) break;

			try {
				const rgEvent = JSON.parse(line);
				if (rgEvent.type !== 'match') continue;

				const match = processRgMatch(rgEvent, projectsDir);
				if (!match) continue;

				const promise = processMatch(match, terms, emittedSessions, callbacks).then(
					(emitted) => {
						if (emitted) totalEmitted++;
					}
				);
				pendingPromises.push(promise);
			} catch {
				continue;
			}
		}

		Promise.all(pendingPromises).then(() => {
			callbacks.onDone(totalEmitted);
		});
	});

	rgProcess.on('error', () => {
		if (closed) return;
		closed = true;
		clearTimeout(timeout);
		// rg binary not found or execution error — fall back
		fallbackIndexSearch(query, projectFilter, callbacks);
	});

	return rgProcess;
}

function processRgMatch(rgEvent: Record<string, unknown>, projectsDir: string): RgMatch | null {
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

	return { projectId, sessionId, lineText };
}

/**
 * Process a single rg match: parse JSONL, extract text, verify match, create result.
 * Dedup happens AFTER synchronous filtering but BEFORE async metadata load.
 * Since async functions run synchronously until the first await, the dedup
 * has()+add() is atomic within the event loop — no race window.
 */
async function processMatch(
	match: RgMatch,
	terms: string[],
	emittedSessions: Set<string>,
	callbacks: StreamingSearchCallbacks
): Promise<boolean> {
	// --- All synchronous: parse, filter, dedup ---

	// Parse the JSONL line
	let record: Record<string, unknown>;
	try {
		record = JSON.parse(match.lineText);
	} catch {
		return false;
	}

	// Extract actual text content (only user/assistant messages)
	const textContent = extractTextContent(record);
	if (!textContent) return false;

	// Verify ALL terms appear in the actual text content
	const lowerText = textContent.toLowerCase();
	if (!terms.every((t) => lowerText.includes(t))) return false;

	// Dedup: check AFTER filtering passes, BEFORE async work.
	// This is atomic because no await has occurred yet.
	const dedupeKey = `${match.projectId}/${match.sessionId}`;
	if (emittedSessions.has(dedupeKey)) return false;
	emittedSessions.add(dedupeKey);

	// Create snippet from the actual text content
	const snippet = createSnippet(textContent, terms[0]);

	// --- Async: metadata enrichment (only the dedup winner reaches here) ---

	const meta = await loadSessionMeta(match.projectId, match.sessionId);

	let modified = meta?.modified || '';
	if (!modified) {
		// Fallback: use file mtime
		try {
			const filePath = path.join(getProjectsDir(), match.projectId, match.sessionId + '.jsonl');
			const fileStat = await stat(filePath);
			modified = fileStat.mtime.toISOString();
		} catch {
			modified = new Date().toISOString();
		}
	}

	// Relevance: terms in firstPrompt/summary score higher than body-only matches
	const promptLower = (meta?.firstPrompt || '').toLowerCase();
	const summaryLower = (meta?.summary || '').toLowerCase();
	let relevance = 0;
	for (const t of terms) {
		if (promptLower.includes(t)) relevance += 2;
		if (summaryLower.includes(t)) relevance += 1;
	}

	const result: SearchResult = {
		projectId: match.projectId,
		projectName: dirNameToDisplayName(match.projectId),
		sessionId: match.sessionId,
		sessionSummary: meta?.summary || '',
		firstPrompt: meta?.firstPrompt || '',
		snippets: [snippet],
		modified,
		relevance
	};

	callbacks.onResult(result);
	return true;
}

/**
 * Fallback: search using sessions-index.json when rg is unavailable.
 */
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

/**
 * Non-streaming search for backwards compatibility.
 */
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
				onDone: () => {
					resolve(
						results.sort((a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime())
					);
				},
				onError: () => resolve([])
			},
			projectFilter
		);

		// If searchSessionsStreaming returned null, callbacks fire synchronously
		if (!rgProcess) return;
	});
}
