import { spawn, type ChildProcess } from 'child_process';
import { readdir, stat } from 'fs/promises';
import path from 'path';
import { rgPath } from '@vscode/ripgrep';
import type { SearchResult } from '$lib/types.js';
import { dirNameToDisplayName, parseSearchTerms } from '$lib/utils.js';
import { getProjectsDir } from './paths.js';
import { reconcileProjectNow } from './reconciler.js';
import {
	getIndexedSessionMeta,
	searchIndexedSessions,
	type IndexedSearchQuery,
	type IndexedSearchSession
} from './session-index-sqlite.js';

interface RgMatch {
	projectId: string;
	sessionId: string;
	filePath: string;
	lineText: string;
}

interface ParsedSearchQuery {
	textTerms: string[];
	toolNames: string[];
	branchTerms: string[];
	isErrorOnly: boolean;
	isSubagentOnly: boolean;
	hasTokensOnly: boolean;
	rawMode: boolean;
}

export interface SearchHandle {
	kill(): void;
}

export interface StreamingSearchCallbacks {
	onResult: (result: SearchResult) => void;
	onDone: (totalSessions: number) => void;
	onError: (error: string) => void;
}

const indexingPromises = new Map<string, Promise<void>>();

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

function parseStructuredQuery(query: string): ParsedSearchQuery {
	const textParts: string[] = [];
	const toolNames: string[] = [];
	const branchTerms: string[] = [];
	let isErrorOnly = false;
	let isSubagentOnly = false;
	let hasTokensOnly = false;
	let rawMode = false;

	for (const token of query.trim().split(/\s+/).filter(Boolean)) {
		const lowerToken = token.toLowerCase();

		if (lowerToken.startsWith('tool:') && token.length > 'tool:'.length) {
			toolNames.push(token.slice('tool:'.length));
			continue;
		}

		if (lowerToken.startsWith('branch:') && token.length > 'branch:'.length) {
			branchTerms.push(token.slice('branch:'.length));
			continue;
		}

		if (lowerToken === 'is:error') {
			isErrorOnly = true;
			continue;
		}

		if (lowerToken === 'is:subagent') {
			isSubagentOnly = true;
			continue;
		}

		if (lowerToken === 'has:tokens' || lowerToken === 'has:cost') {
			hasTokensOnly = true;
			continue;
		}

		if (lowerToken === 'debug:raw' || lowerToken === 'mode:raw' || lowerToken === 'source:raw') {
			rawMode = true;
			continue;
		}

		textParts.push(token);
	}

	return {
		textTerms: parseSearchTerms(textParts.join(' ')),
		toolNames,
		branchTerms,
		isErrorOnly,
		isSubagentOnly,
		hasTokensOnly,
		rawMode
	};
}

function hasStructuredFilters(query: ParsedSearchQuery): boolean {
	return (
		query.toolNames.length > 0 ||
		query.branchTerms.length > 0 ||
		query.isErrorOnly ||
		query.isSubagentOnly ||
		query.hasTokensOnly
	);
}

function hasSearchIntent(query: ParsedSearchQuery): boolean {
	return query.textTerms.length > 0 || hasStructuredFilters(query);
}

function toIndexedSearchQuery(
	query: ParsedSearchQuery,
	projectFilter?: string
): IndexedSearchQuery {
	return {
		textTerms: query.textTerms,
		projectFilter,
		toolNames: query.toolNames,
		branchTerms: query.branchTerms,
		isErrorOnly: query.isErrorOnly,
		isSubagentOnly: query.isSubagentOnly,
		hasTokensOnly: query.hasTokensOnly
	};
}

function createSnippet(text: string, term: string): string {
	const normalized = text.replace(/\n/g, ' ').trim();
	if (!normalized) return '';

	const lower = normalized.toLowerCase();
	const termLower = term.toLowerCase();
	const idx = lower.indexOf(termLower);
	if (idx === -1) return normalized.slice(0, 150);

	const start = Math.max(0, idx - 60);
	const end = Math.min(normalized.length, idx + term.length + 90);

	let snippet = normalized.slice(start, end);
	if (start > 0) snippet = '...' + snippet;
	if (end < normalized.length) snippet += '...';

	return snippet;
}

function createSnippets(searchText: string, terms: string[]): string[] {
	if (!searchText.trim()) return [];

	if (terms.length === 0) {
		const fallback = searchText.replace(/\n/g, ' ').trim().slice(0, 150);
		return fallback ? [fallback] : [];
	}

	const snippets: string[] = [];
	for (const term of terms.slice(0, 2)) {
		const snippet = createSnippet(searchText, term);
		if (snippet && !snippets.includes(snippet)) {
			snippets.push(snippet);
		}
	}

	return snippets;
}

async function ensureProjectIndexed(projectId: string): Promise<void> {
	const pending = indexingPromises.get(projectId);
	if (pending) {
		await pending;
		return;
	}

	const indexing = reconcileProjectNow(projectId)
		.then(() => undefined)
		.finally(() => {
			indexingPromises.delete(projectId);
		});

	indexingPromises.set(projectId, indexing);
	await indexing;
}

async function ensureSearchProjectsIndexed(projectFilter?: string): Promise<void> {
	const projectsDir = getProjectsDir();
	let projectIds: string[];

	try {
		projectIds = projectFilter ? [projectFilter] : await readdir(projectsDir);
	} catch {
		return;
	}

	await Promise.all(projectIds.map((projectId) => ensureProjectIndexed(projectId)));
}

async function loadSessionMeta(projectId: string, sessionId: string) {
	let meta = getIndexedSessionMeta(projectId, sessionId);
	if (meta) return meta;

	await ensureProjectIndexed(projectId);
	meta = getIndexedSessionMeta(projectId, sessionId);
	return meta;
}

function toSearchResult(result: IndexedSearchSession, terms: string[]): SearchResult {
	return {
		projectId: result.projectId,
		projectName: dirNameToDisplayName(result.projectId),
		sessionId: result.sessionId,
		sessionSummary: result.summary,
		firstPrompt: result.firstPrompt,
		snippets: createSnippets(result.searchText, terms),
		modified: result.modified,
		relevance: result.relevance
	};
}

async function emitIndexedMatches(
	query: ParsedSearchQuery,
	projectFilter: string | undefined,
	emittedSessions: Set<string>,
	callbacks: StreamingSearchCallbacks,
	cancelled: { value: boolean }
): Promise<number> {
	await ensureSearchProjectsIndexed(projectFilter);
	if (cancelled.value) return 0;

	const results = searchIndexedSessions(toIndexedSearchQuery(query, projectFilter), 500);
	let emitted = 0;

	for (const result of results) {
		if (cancelled.value) break;

		const dedupeKey = `${result.projectId}/${result.sessionId}`;
		if (emittedSessions.has(dedupeKey)) continue;
		emittedSessions.add(dedupeKey);

		callbacks.onResult(toSearchResult(result, query.textTerms));
		emitted += 1;

		if (emitted % 25 === 0) {
			await new Promise((resolve) => setTimeout(resolve, 0));
		}
	}

	return emitted;
}

function processRgMatch(rgEvent: Record<string, unknown>, projectsDir: string): RgMatch | null {
	const data = rgEvent.data as {
		path?: { text?: string };
		lines?: { text?: string };
	};

	const filePath = data?.path?.text;
	const lineText = data?.lines?.text;
	if (!filePath || !lineText) return null;

	const relPath = filePath.replace(projectsDir + '/', '');
	const parts = relPath.split('/');
	if (parts.length < 2) return null;

	const projectId = parts[0];
	if (!projectId) return null;

	if (parts.length === 2) {
		const sessionId = parts[1]?.replace('.jsonl', '');
		if (!sessionId) return null;
		return { projectId, sessionId, filePath, lineText };
	}

	if (parts.length === 4 && parts[2] === 'subagents') {
		const parentSessionId = parts[1];
		const childSessionId = parts[3]?.replace('.jsonl', '');
		if (!parentSessionId || !childSessionId) return null;

		return {
			projectId,
			sessionId: `${parentSessionId}~subagent~${childSessionId}`,
			filePath,
			lineText
		};
	}

	return null;
}

async function processRawMatch(
	match: RgMatch,
	terms: string[],
	emittedSessions: Set<string>,
	callbacks: StreamingSearchCallbacks
): Promise<boolean> {
	let record: Record<string, unknown>;
	try {
		record = JSON.parse(match.lineText);
	} catch {
		return false;
	}

	const textContent = extractTextContent(record);
	if (!textContent) return false;

	const lowerText = textContent.toLowerCase();
	if (!terms.every((term) => lowerText.includes(term))) return false;

	const dedupeKey = `${match.projectId}/${match.sessionId}`;
	if (emittedSessions.has(dedupeKey)) return false;
	emittedSessions.add(dedupeKey);

	const meta = await loadSessionMeta(match.projectId, match.sessionId);

	let modified = meta?.modified || '';
	if (!modified) {
		try {
			const fileStat = await stat(match.filePath);
			modified = fileStat.mtime.toISOString();
		} catch {
			modified = new Date().toISOString();
		}
	}

	const promptLower = (meta?.firstPrompt || '').toLowerCase();
	const summaryLower = (meta?.summary || '').toLowerCase();
	let relevance = 0;
	for (const term of terms) {
		if (promptLower.includes(term)) relevance += 2;
		if (summaryLower.includes(term)) relevance += 1;
	}

	callbacks.onResult({
		projectId: match.projectId,
		projectName: dirNameToDisplayName(match.projectId),
		sessionId: match.sessionId,
		sessionSummary: meta?.summary || '',
		firstPrompt: meta?.firstPrompt || '',
		snippets: createSnippets(textContent, terms),
		modified,
		relevance
	});

	return true;
}

function searchSessionsRawStreaming(
	textTerms: string[],
	callbacks: StreamingSearchCallbacks,
	projectFilter?: string
): SearchHandle | null {
	if (textTerms.length === 0) {
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
		textTerms[0],
		searchPath
	];

	let rgProcess: ChildProcess;
	try {
		rgProcess = spawn(rgPath, rgArgs);
	} catch {
		void (async () => {
			const emitted = await emitIndexedMatches(
				{
					textTerms,
					toolNames: [],
					branchTerms: [],
					isErrorOnly: false,
					isSubagentOnly: false,
					hasTokensOnly: false,
					rawMode: true
				},
				projectFilter,
				new Set<string>(),
				callbacks,
				{ value: false }
			);
			callbacks.onDone(emitted);
		})();
		return null;
	}

	const emittedSessions = new Set<string>();
	let totalEmitted = 0;
	let closed = false;
	const pendingPromises: Promise<void>[] = [];
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
		for (const line of fullOutput.split('\n')) {
			if (!line.trim()) continue;
			if (emittedSessions.size >= 500) break;

			try {
				const rgEvent = JSON.parse(line);
				if (rgEvent.type !== 'match') continue;

				const match = processRgMatch(rgEvent, projectsDir);
				if (!match) continue;

				const promise = processRawMatch(match, textTerms, emittedSessions, callbacks).then(
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
		callbacks.onDone(totalEmitted);
	});

	return rgProcess;
}

/**
 * SQLite-first streaming search. Use `debug:raw`, `mode:raw`, or `source:raw`
 * in the query as an escape hatch to force the legacy ripgrep path.
 */
export function searchSessionsStreaming(
	query: string,
	callbacks: StreamingSearchCallbacks,
	projectFilter?: string
): SearchHandle | null {
	const parsedQuery = parseStructuredQuery(query);
	if (!hasSearchIntent(parsedQuery)) {
		callbacks.onDone(0);
		return null;
	}

	if (
		parsedQuery.rawMode &&
		parsedQuery.textTerms.length > 0 &&
		!hasStructuredFilters(parsedQuery)
	) {
		return searchSessionsRawStreaming(parsedQuery.textTerms, callbacks, projectFilter);
	}

	const cancelled = { value: false };
	void emitIndexedMatches(parsedQuery, projectFilter, new Set<string>(), callbacks, cancelled)
		.then((emitted) => {
			if (!cancelled.value) {
				callbacks.onDone(emitted);
			}
		})
		.catch((error) => {
			if (!cancelled.value) {
				callbacks.onError(error instanceof Error ? error.message : 'Search failed');
			}
		});

	return {
		kill() {
			cancelled.value = true;
		}
	};
}

export async function searchSessions(
	query: string,
	projectFilter?: string
): Promise<SearchResult[]> {
	return new Promise((resolve) => {
		const results: SearchResult[] = [];

		searchSessionsStreaming(
			query,
			{
				onResult: (result) => results.push(result),
				onDone: () => {
					resolve(
						results.sort(
							(a, b) =>
								b.relevance - a.relevance ||
								new Date(b.modified).getTime() - new Date(a.modified).getTime()
						)
					);
				},
				onError: () => resolve([])
			},
			projectFilter
		);
	});
}
