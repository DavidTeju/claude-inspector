/**
 * @module
 * Session search orchestration. The default path searches the SQLite index first;
 * ripgrep remains available as a raw-mode escape hatch and reflects the older
 * line-oriented search backend.
 */

import { spawn, type ChildProcess } from 'child_process';
import { readdir, stat } from 'fs/promises';
import path from 'path';
import { rgPath } from '@vscode/ripgrep';
import { parseDateFilter } from '$lib/shared/date-filter.js';
import { tokenizeQuery } from '$lib/shared/query-tokenizer.js';
import type { SearchResult } from '$lib/types.js';
import { dirNameToDisplayName, parseSearchTerms, RAW_MODE_TOKENS } from '$lib/utils.js';
import { getProjectsDir } from './paths.js';
import { normalizeProjectId } from './project-id.js';
import { reconcileProjectNow } from './reconciler.js';
import {
	getIndexedSessionMeta,
	searchIndexedSessions,
	type IndexedSearchQuery,
	type IndexedSearchSession
} from './session-index-sqlite.js';
import type { FilterTerm } from './session-index-types.js';

const PREVIEW_MAX_LENGTH = 150;
const CONTEXT_BEFORE_LENGTH = 60;
const CONTEXT_AFTER_LENGTH = 90;
const MAX_DB_SESSIONS = 500;
const SEARCH_BATCH_SIZE = 25;
const RG_TIMEOUT_MS = 10_000;
const MAX_EMITTED_SESSIONS = 500;
const JSON_INDENT = 4;

interface RgMatch {
	projectId: string;
	sessionId: string;
	filePath: string;
	lineText: string;
}

type IncludeExcludeFilter = 'include' | 'exclude' | null;

interface ParsedSearchQuery {
	textTerms: string[];
	phraseTerms: string[];
	projects: FilterTerm[];
	models: FilterTerm[];
	errorFilter: IncludeExcludeFilter;
	subagentFilter: IncludeExcludeFilter;
	dateFilter: { after: string; before: string } | null;
	rawMode: boolean;
	regexMode: boolean;
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
 * Extracts plain text from a parsed JSONL record for raw line-oriented search.
 * Only user/assistant text blocks are included here; tool_use, tool_result,
 * thinking, and other non-text content are intentionally ignored so raw-mode
 * results stay aligned with the searchable human-readable transcript text.
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

/** Value-prefix filters recognised by the structured query parser. */
const VALUE_PREFIX_TARGETS = ['project:', 'model:'] as const;

/** Tries to match a token against value-prefix filters (tool:, branch:, etc.). */
function matchValuePrefix(
	body: string,
	lowerBody: string,
	negated: boolean,
	collectors: Record<string, FilterTerm[]>
): boolean {
	for (const prefix of VALUE_PREFIX_TARGETS) {
		if (lowerBody.startsWith(prefix) && body.length > prefix.length) {
			const key = prefix.slice(0, -1); // 'tool:' → 'tool'
			collectors[key].push({ value: body.slice(prefix.length), negated });
			return true;
		}
	}
	return false;
}

/**
 * Parses free text plus filter tokens from the search box.
 * Keep this in sync with `parseClientFilters()` so the client-side filter chips
 * represent the exact same grammar that the server executes.
 */
function parseStructuredQuery(query: string): ParsedSearchQuery {
	const textParts: string[] = [];
	const phraseTerms: string[] = [];
	const collectors: Record<string, FilterTerm[]> = {
		project: [],
		model: []
	};
	let errorFilter: IncludeExcludeFilter = null;
	let subagentFilter: IncludeExcludeFilter = null;
	let dateFilter: { after: string; before: string } | null = null;
	let rawMode = false;
	let regexMode = false;

	for (const token of tokenizeQuery(query)) {
		if (token.quoted) {
			phraseTerms.push(token.body);
			continue;
		}

		const lowerBody = token.body.toLowerCase();

		if (!token.negated && RAW_MODE_TOKENS.has(lowerBody)) {
			rawMode = true;
			continue;
		}
		if (!token.negated && lowerBody === 'mode:regex') {
			regexMode = true;
			continue;
		}

		if (matchValuePrefix(token.body, lowerBody, token.negated, collectors)) continue;

		if (lowerBody.startsWith('date:') && token.body.length > 'date:'.length) {
			const parsed = parseDateFilter(token.body.slice('date:'.length));
			if (parsed) dateFilter = parsed;
			continue;
		}

		if (lowerBody === 'has:error' || lowerBody === 'is:error') {
			errorFilter = token.negated ? 'exclude' : 'include';
			continue;
		}
		if (lowerBody === 'is:subagent') {
			subagentFilter = token.negated ? 'exclude' : 'include';
			continue;
		}

		textParts.push(token.body);
	}

	return {
		textTerms: parseSearchTerms(textParts.join(' ')),
		phraseTerms,
		projects: collectors.project,
		models: collectors.model,
		errorFilter,
		subagentFilter,
		dateFilter,
		rawMode,
		regexMode
	};
}

function hasStructuredFilters(query: ParsedSearchQuery): boolean {
	return (
		query.projects.length > 0 ||
		query.models.length > 0 ||
		query.errorFilter !== null ||
		query.subagentFilter !== null ||
		query.dateFilter !== null
	);
}

function hasSearchIntent(query: ParsedSearchQuery): boolean {
	return query.textTerms.length > 0 || query.phraseTerms.length > 0 || hasStructuredFilters(query);
}

function toIndexedSearchQuery(
	query: ParsedSearchQuery,
	projectFilter?: string
): IndexedSearchQuery {
	return {
		textTerms: query.textTerms,
		phraseTerms: query.phraseTerms,
		projectFilter,
		projects: query.projects,
		models: query.models,
		errorFilter: query.errorFilter,
		subagentFilter: query.subagentFilter,
		dateAfter: query.dateFilter?.after,
		dateBefore: query.dateFilter?.before
	};
}

/**
 * Builds one preview snippet around a matched term.
 * The window is intentionally asymmetric so users get slightly more context
 * after the match than before it.
 */
function createSnippet(text: string, term: string): string {
	const normalized = text.replace(/\n/g, ' ').trim();
	if (!normalized) return '';

	const lower = normalized.toLowerCase();
	const termLower = term.toLowerCase();
	const idx = lower.indexOf(termLower);
	if (idx === -1) return normalized.slice(0, PREVIEW_MAX_LENGTH);

	const start = Math.max(0, idx - CONTEXT_BEFORE_LENGTH);
	const end = Math.min(normalized.length, idx + term.length + CONTEXT_AFTER_LENGTH);

	let snippet = normalized.slice(start, end);
	if (start > 0) snippet = '...' + snippet;
	if (end < normalized.length) snippet += '...';

	return snippet;
}

function createSnippets(searchText: string, terms: string[]): string[] {
	if (!searchText.trim()) return [];

	if (terms.length === 0) {
		const fallback = searchText.replace(/\n/g, ' ').trim().slice(0, PREVIEW_MAX_LENGTH);
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

/**
 * Ensures a project's SQLite index exists before querying it.
 * The promise map deduplicates concurrent callers so search requests do not
 * race each other into redundant reconciliation work.
 */
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

/**
 * Streams indexed matches to the caller while preserving synchronous dedupe.
 * Emitted-session tracking must happen inline with `onResult` so concurrent raw
 * fallback work cannot double-publish the same session.
 */
async function emitIndexedMatches(
	query: ParsedSearchQuery,
	projectFilter: string | undefined,
	emittedSessions: Set<string>,
	callbacks: StreamingSearchCallbacks,
	cancelled: { value: boolean }
): Promise<number> {
	await ensureSearchProjectsIndexed(projectFilter);
	if (cancelled.value) return 0;

	const results = searchIndexedSessions(
		toIndexedSearchQuery(query, projectFilter),
		MAX_DB_SESSIONS
	);
	let emitted = 0;

	for (const result of results) {
		if (cancelled.value) break;

		const dedupeKey = `${result.projectId}/${result.sessionId}`;
		if (emittedSessions.has(dedupeKey)) continue;
		emittedSessions.add(dedupeKey);

		callbacks.onResult(toSearchResult(result, [...query.textTerms, ...query.phraseTerms]));
		emitted += 1;

		if (emitted % SEARCH_BATCH_SIZE === 0) {
			await new Promise((resolve) => setTimeout(resolve, 0));
		}
	}

	return emitted;
}

/**
 * Parses a ripgrep relative path into project/session identifiers.
 * Subagent sessions are encoded as `parentSessionId~subagent~childSessionId`
 * to match the route IDs produced by session discovery.
 */
function parseSessionPath(relPath: string): { projectId: string; sessionId: string } | null {
	const parts = relPath.split('/');
	if (parts.length < 2) return null;

	const projectId = parts[0];
	if (!projectId) return null;

	if (parts.length === 2) {
		const sessionId = parts[1]?.replace('.jsonl', '');
		if (!sessionId) return null;
		return { projectId, sessionId };
	}

	if (parts.length === JSON_INDENT && parts[2] === 'subagents') {
		const parentSessionId = parts[1];
		const childSessionId = parts[3]?.replace('.jsonl', '');
		if (!parentSessionId || !childSessionId) return null;
		return {
			projectId,
			sessionId: `${parentSessionId}~subagent~${childSessionId}`
		};
	}

	return null;
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
	const parsed = parseSessionPath(relPath);
	if (!parsed) return null;

	return { ...parsed, filePath, lineText };
}

/**
 * Parse a JSONL line into a record and extract its text content.
 */
function parseRecordLine(lineText: string): string | null {
	let record: Record<string, unknown>;
	try {
		record = JSON.parse(lineText);
	} catch {
		return null;
	}
	return extractTextContent(record);
}

/**
 * Computes the lightweight raw-search relevance score.
 * Prompt matches count double so the first user intent outranks equivalent
 * summary-only hits when the ripgrep fallback path is used.
 */
function computeRelevance(
	terms: string[],
	meta: { firstPrompt?: string; summary?: string } | null | undefined
): number {
	const promptLower = (meta?.firstPrompt || '').toLowerCase();
	const summaryLower = (meta?.summary || '').toLowerCase();
	let relevance = 0;
	for (const term of terms) {
		if (promptLower.includes(term)) relevance += 2;
		if (summaryLower.includes(term)) relevance += 1;
	}
	return relevance;
}

/**
 * Converts a ripgrep line match into a deduplicated SearchResult.
 * This is intentionally async because it may need indexed metadata or a file
 * stat fallback before the result can be emitted.
 */
async function processRawMatch(
	match: RgMatch,
	terms: string[],
	emittedSessions: Set<string>,
	callbacks: StreamingSearchCallbacks
): Promise<boolean> {
	const textContent = parseRecordLine(match.lineText);
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

	callbacks.onResult({
		projectId: match.projectId,
		projectName: dirNameToDisplayName(match.projectId),
		sessionId: match.sessionId,
		sessionSummary: meta?.summary || '',
		firstPrompt: meta?.firstPrompt || '',
		snippets: createSnippets(textContent, terms),
		modified,
		relevance: computeRelevance(terms, meta)
	});

	return true;
}

/**
 * Legacy ripgrep-based streaming search used only for explicit raw-mode queries.
 * It searches JSONL lines directly and deduplicates sessions after the subprocess
 * exits. If ripgrep cannot be spawned at all, this path degrades back to indexed
 * search so the request still returns results instead of failing outright.
 */
function searchSessionsRawStreaming(
	textTerms: string[],
	callbacks: StreamingSearchCallbacks,
	projectFilter?: string,
	regexMode = false
): SearchHandle | null {
	if (textTerms.length === 0) {
		callbacks.onDone(0);
		return null;
	}

	const projectsDir = getProjectsDir();
	const searchPath = projectFilter ? path.join(projectsDir, projectFilter) : projectsDir;
	const rgArgs = [
		'--json',
		...(regexMode ? [] : ['--fixed-strings']),
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
					phraseTerms: [],
					projects: [],
					models: [],
					errorFilter: null,
					subagentFilter: null,
					dateFilter: null,
					rawMode: true,
					regexMode: false
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
	}, RG_TIMEOUT_MS);

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
			if (emittedSessions.size >= MAX_EMITTED_SESSIONS) break;

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
 * Main streaming search entry point.
 * SQLite results are preferred because they understand structured filters and
 * session-level metadata; `debug:raw`, `mode:raw`, or `source:raw` force the
 * legacy ripgrep path for text-only troubleshooting.
 */
export function searchSessionsStreaming(
	query: string,
	callbacks: StreamingSearchCallbacks,
	projectFilter?: string
): SearchHandle | null {
	const safeProjectFilter = projectFilter
		? (normalizeProjectId(projectFilter) ?? undefined)
		: undefined;
	if (projectFilter && !safeProjectFilter) {
		callbacks.onError('Invalid project filter');
		return null;
	}

	const parsedQuery = parseStructuredQuery(query);
	if (!hasSearchIntent(parsedQuery)) {
		callbacks.onDone(0);
		return null;
	}

	if (
		(parsedQuery.rawMode || parsedQuery.regexMode) &&
		parsedQuery.textTerms.length > 0 &&
		!hasStructuredFilters(parsedQuery)
	) {
		return searchSessionsRawStreaming(
			parsedQuery.textTerms,
			callbacks,
			safeProjectFilter,
			parsedQuery.regexMode
		);
	}

	const cancelled = { value: false };
	emitIndexedMatches(parsedQuery, safeProjectFilter, new Set<string>(), callbacks, cancelled)
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
