import { mkdirSync } from 'fs';
import type { Stats } from 'fs';
import Database from 'better-sqlite3';
import type { Project, SessionEntry } from '../types.js';
import { dirNameToDisplayName } from '../utils.js';
import type { SessionFileDescriptor } from './session-discovery.js';
import { extractSessionEntry } from './session-metadata.js';
import {
	isAssistantRecord,
	isUserRecord,
	type ClaudeContentBlock,
	type ParsedSessionRecord
} from './session-schema.js';
import { getInspectorDataDir, getSessionIndexDbPath } from './paths.js';

const SESSION_INDEX_DB_VERSION = 1;

interface ProjectRow {
	id: string;
	display_name: string;
	path: string;
	session_count: number;
	last_modified: string;
}

interface SessionRow {
	project_id: string;
	session_id: string;
	display_session_id: string | null;
	full_path: string;
	relative_path: string | null;
	file_mtime: number;
	size_bytes: number;
	first_prompt: string;
	summary: string;
	message_count: number;
	created: string;
	modified: string;
	git_branch: string;
	project_path: string;
	is_sidechain: number;
	is_subagent: number;
	parent_session_id: string | null;
	custom_title: string | null;
	native_summary: string | null;
	last_prompt: string | null;
	token_input: number;
	token_output: number;
	token_cache_read: number;
	token_cache_write: number;
	has_api_error: number;
	has_compaction: number;
}

interface ReconcileStateRow {
	file_path: string;
	session_id: string;
	size_bytes: number;
	mtime_ms: number;
}

interface ToolResultFact {
	resultText?: string;
	isError: boolean;
}

interface IndexedToolFact {
	assistantUuid?: string;
	toolUseId: string;
	toolName: string;
	caller?: string;
	inputJson: string;
	resultText?: string;
	isError: boolean;
}

interface IndexedProgressFact {
	recordIndex: number;
	uuid?: string;
	timestamp?: string;
	progressType?: string;
	label?: string;
	payloadJson?: string;
}

interface IndexedFileFact {
	recordIndex: number;
	path: string;
	kind: string;
}

export interface IndexedSessionData {
	entry: SessionEntry;
	sizeBytes: number;
	tokenInput: number;
	tokenOutput: number;
	tokenCacheRead: number;
	tokenCacheWrite: number;
	hasApiError: boolean;
	hasCompaction: boolean;
	tools: IndexedToolFact[];
	progressEvents: IndexedProgressFact[];
	fileFacts: IndexedFileFact[];
}

export interface StoredIndexedSession {
	entry: SessionEntry;
	sizeBytes: number;
}

type SqlRow = Record<string, unknown>;

let database: Database.Database | null = null;

export function buildIndexedSessionData(
	descriptor: SessionFileDescriptor,
	records: ParsedSessionRecord[],
	fileStat: Stats
): IndexedSessionData | null {
	const entry = extractSessionEntry(descriptor, records, fileStat);
	if (!entry) return null;

	const toolResults = new Map<string, ToolResultFact>();
	const tools = new Map<string, IndexedToolFact>();
	const progressEvents: IndexedProgressFact[] = [];
	const fileFacts: IndexedFileFact[] = [];
	const latestAssistantRecords = new Map<
		string,
		{ record: Extract<ParsedSessionRecord['record'], { type: 'assistant' }>; recordIndex: number }
	>();

	let hasApiError = false;
	let hasCompaction = false;

	for (const parsedRecord of records) {
		const { record, source } = parsedRecord;

		if (record.type === 'queue-operation' && record.operation?.toLowerCase().includes('compact')) {
			hasCompaction = true;
		}

		if (record.type === 'file-history-snapshot' && record.snapshot) {
			for (const filePath of Object.keys(record.snapshot)) {
				fileFacts.push({
					recordIndex: source.recordIndex,
					path: filePath,
					kind: record.isSnapshotUpdate ? 'file-history-update' : 'file-history-snapshot'
				});
			}
		}

		if (record.type === 'progress') {
			progressEvents.push({
				recordIndex: source.recordIndex,
				uuid: record.uuid,
				timestamp: record.timestamp,
				progressType: asString(record.data?.type),
				label: asString(record.data?.label) || asString(record.data?.output),
				payloadJson: toJson(record.data)
			});
			continue;
		}

		if (record.type === 'system') {
			if (record.subtype === 'api_error') {
				hasApiError = true;
			}
			if (record.compactMetadata) {
				hasCompaction = true;
			}
			continue;
		}

		if (isUserRecord(record)) {
			if (record.isCompactSummary) {
				hasCompaction = true;
			}

			if (!Array.isArray(record.message.content)) continue;

			for (const block of record.message.content) {
				if (block.type !== 'tool_result' || !block.tool_use_id) continue;

				toolResults.set(block.tool_use_id, {
					resultText: flattenContent(block.content),
					isError: block.is_error ?? false
				});
			}

			continue;
		}

		if (!isAssistantRecord(record)) continue;

		const assistantMessageKey = record.message.id || record.uuid;
		const previousAssistant = latestAssistantRecords.get(assistantMessageKey);
		if (!previousAssistant || previousAssistant.recordIndex < source.recordIndex) {
			latestAssistantRecords.set(assistantMessageKey, { record, recordIndex: source.recordIndex });
		}

		if (record.isApiErrorMessage || record.apiError || record.error) {
			hasApiError = true;
		}

		if (!Array.isArray(record.message.content)) continue;

		for (const block of record.message.content) {
			if (block.type !== 'tool_use' || !block.id) continue;

			const toolResult = toolResults.get(block.id);
			tools.set(block.id, {
				assistantUuid: record.uuid,
				toolUseId: block.id,
				toolName: block.name || 'unknown',
				caller: block.caller,
				inputJson: JSON.stringify(block.input || {}),
				resultText: toolResult?.resultText,
				isError: toolResult?.isError ?? false
			});
		}
	}

	let tokenInput = 0;
	let tokenOutput = 0;
	let tokenCacheRead = 0;
	let tokenCacheWrite = 0;

	for (const { record } of latestAssistantRecords.values()) {
		tokenInput += readUsageNumber(record.message.usage, ['input_tokens']);
		tokenOutput += readUsageNumber(record.message.usage, ['output_tokens']);
		tokenCacheRead += readUsageNumber(record.message.usage, [
			'cache_read_input_tokens',
			'cache_read_tokens'
		]);
		tokenCacheWrite += readUsageNumber(record.message.usage, [
			'cache_creation_input_tokens',
			'cache_write_input_tokens',
			'cache_creation_tokens',
			'cache_write_tokens'
		]);
	}

	return {
		entry,
		sizeBytes: fileStat.size,
		tokenInput,
		tokenOutput,
		tokenCacheRead,
		tokenCacheWrite,
		hasApiError,
		hasCompaction,
		tools: [...tools.values()],
		progressEvents,
		fileFacts
	};
}

export function getIndexedProjects(): Project[] {
	const database = getDatabase();
	const rows = database
		.prepare<[], ProjectRow>(
			`SELECT id, display_name, path, session_count, last_modified
			 FROM projects
			 WHERE session_count > 0
			 ORDER BY last_modified DESC`
		)
		.all();

	return toSqlRows(rows).map((row) => {
		const projectRow = toProjectRow(row);
		return {
			id: projectRow.id,
			displayName: projectRow.display_name,
			path: projectRow.path,
			sessionCount: projectRow.session_count,
			lastModified: projectRow.last_modified
		};
	});
}

export function getIndexedProjectIds(): string[] {
	const database = getDatabase();
	const rows = database.prepare<[], { id: string }>(`SELECT id FROM projects`).all();
	return toSqlRows(rows).map((row) => requireString(row, 'id'));
}

export function getIndexedSessions(projectId: string): SessionEntry[] {
	const database = getDatabase();
	const rows = database
		.prepare<[string], SessionRow>(
			`SELECT *
			 FROM sessions
			 WHERE project_id = ?
			 ORDER BY modified DESC`
		)
		.all(projectId);

	return toSqlRows(rows).map((row) => rowToSessionEntry(toSessionRow(row)));
}

export function getIndexedSessionsByPath(projectId: string): Map<string, StoredIndexedSession> {
	const database = getDatabase();
	const rows = database
		.prepare<[string], SessionRow>(
			`SELECT *
			 FROM sessions
			 WHERE project_id = ?`
		)
		.all(projectId);

	return new Map(
		toSqlRows(rows).map((row) => {
			const sessionRow = toSessionRow(row);
			return [
				sessionRow.full_path,
				{
					entry: rowToSessionEntry(sessionRow),
					sizeBytes: sessionRow.size_bytes
				}
			] satisfies [string, StoredIndexedSession];
		})
	);
}

export function getReconcileStateByPath(projectId: string): Map<string, ReconcileStateRow> {
	const database = getDatabase();
	const rows = database
		.prepare<[string], ReconcileStateRow>(
			`SELECT file_path, session_id, size_bytes, mtime_ms
			 FROM reconcile_state
			 WHERE project_id = ?`
		)
		.all(projectId);

	return new Map(
		toSqlRows(rows).map((row) => {
			const reconcileStateRow = toReconcileStateRow(row);
			return [reconcileStateRow.file_path, reconcileStateRow] satisfies [string, ReconcileStateRow];
		})
	);
}

export function persistProjectIndex(
	projectId: string,
	projectPath: string,
	changedSessions: IndexedSessionData[],
	removedPaths: string[],
	allEntries: SessionEntry[]
): void {
	const database = getDatabase();
	const startedAt = new Date().toISOString();
	const lastModified = allEntries[0]?.modified || '';

	database.exec('BEGIN IMMEDIATE');

	try {
		if (allEntries.length === 0) {
			database.prepare(`DELETE FROM projects WHERE id = ?`).run(projectId);
			database.exec('COMMIT');
			return;
		}

		database
			.prepare(
				`INSERT INTO projects (id, display_name, path, session_count, last_modified, updated_at)
				 VALUES (?, ?, ?, ?, ?, ?)
				 ON CONFLICT(id) DO UPDATE SET
					display_name = excluded.display_name,
					path = excluded.path,
					session_count = excluded.session_count,
					last_modified = excluded.last_modified,
					updated_at = excluded.updated_at`
			)
			.run(
				projectId,
				dirNameToDisplayName(projectId),
				projectPath,
				allEntries.length,
				lastModified,
				startedAt
			);

		const deleteSessionStatement = database.prepare(
			`DELETE FROM sessions WHERE project_id = ? AND full_path = ?`
		);
		for (const removedPath of removedPaths) {
			deleteSessionStatement.run(projectId, removedPath);
		}

		const upsertSessionStatement = database.prepare(
			`INSERT INTO sessions (
				project_id,
				session_id,
				display_session_id,
				full_path,
				relative_path,
				file_mtime,
				size_bytes,
				first_prompt,
				summary,
				message_count,
				created,
				modified,
				git_branch,
				project_path,
				is_sidechain,
				is_subagent,
				parent_session_id,
				custom_title,
				native_summary,
				last_prompt,
				token_input,
				token_output,
				token_cache_read,
				token_cache_write,
				has_api_error,
				has_compaction
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			ON CONFLICT(project_id, session_id) DO UPDATE SET
				display_session_id = excluded.display_session_id,
				full_path = excluded.full_path,
				relative_path = excluded.relative_path,
				file_mtime = excluded.file_mtime,
				size_bytes = excluded.size_bytes,
				first_prompt = excluded.first_prompt,
				summary = excluded.summary,
				message_count = excluded.message_count,
				created = excluded.created,
				modified = excluded.modified,
				git_branch = excluded.git_branch,
				project_path = excluded.project_path,
				is_sidechain = excluded.is_sidechain,
				is_subagent = excluded.is_subagent,
				parent_session_id = excluded.parent_session_id,
				custom_title = excluded.custom_title,
				native_summary = excluded.native_summary,
				last_prompt = excluded.last_prompt,
				token_input = excluded.token_input,
				token_output = excluded.token_output,
				token_cache_read = excluded.token_cache_read,
				token_cache_write = excluded.token_cache_write,
				has_api_error = excluded.has_api_error,
				has_compaction = excluded.has_compaction`
		);

		const deleteToolsStatement = database.prepare(
			`DELETE FROM session_tools WHERE project_id = ? AND session_id = ?`
		);
		const deleteProgressStatement = database.prepare(
			`DELETE FROM session_progress WHERE project_id = ? AND session_id = ?`
		);
		const deleteFilesStatement = database.prepare(
			`DELETE FROM session_files WHERE project_id = ? AND session_id = ?`
		);
		const upsertReconcileStateStatement = database.prepare(
			`INSERT INTO reconcile_state (file_path, project_id, session_id, size_bytes, mtime_ms, indexed_at)
			 VALUES (?, ?, ?, ?, ?, ?)
			 ON CONFLICT(file_path) DO UPDATE SET
				project_id = excluded.project_id,
				session_id = excluded.session_id,
				size_bytes = excluded.size_bytes,
				mtime_ms = excluded.mtime_ms,
				indexed_at = excluded.indexed_at`
		);
		const insertToolStatement = database.prepare(
			`INSERT INTO session_tools (
				project_id,
				session_id,
				tool_use_id,
				assistant_uuid,
				tool_name,
				caller,
				input_json,
				result_text,
				is_error
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
		);
		const insertProgressStatement = database.prepare(
			`INSERT INTO session_progress (
				project_id,
				session_id,
				record_idx,
				uuid,
				timestamp,
				progress_type,
				label,
				payload_json
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
		);
		const insertFileStatement = database.prepare(
			`INSERT INTO session_files (
				project_id,
				session_id,
				record_idx,
				path,
				kind
			) VALUES (?, ?, ?, ?, ?)`
		);

		for (const session of changedSessions) {
			upsertSessionStatement.run(
				projectId,
				session.entry.sessionId,
				session.entry.displaySessionId ?? null,
				session.entry.fullPath,
				session.entry.relativePath ?? null,
				session.entry.fileMtime,
				session.sizeBytes,
				session.entry.firstPrompt,
				session.entry.summary,
				session.entry.messageCount,
				session.entry.created,
				session.entry.modified,
				session.entry.gitBranch,
				session.entry.projectPath,
				toSqlBoolean(session.entry.isSidechain),
				toSqlBoolean(session.entry.isSubagent ?? false),
				session.entry.parentSessionId ?? null,
				session.entry.customTitle ?? null,
				session.entry.nativeSummary ?? null,
				session.entry.lastPrompt ?? null,
				session.tokenInput,
				session.tokenOutput,
				session.tokenCacheRead,
				session.tokenCacheWrite,
				toSqlBoolean(session.hasApiError),
				toSqlBoolean(session.hasCompaction)
			);

			deleteToolsStatement.run(projectId, session.entry.sessionId);
			deleteProgressStatement.run(projectId, session.entry.sessionId);
			deleteFilesStatement.run(projectId, session.entry.sessionId);

			upsertReconcileStateStatement.run(
				session.entry.fullPath,
				projectId,
				session.entry.sessionId,
				session.sizeBytes,
				session.entry.fileMtime,
				startedAt
			);

			for (const tool of session.tools) {
				insertToolStatement.run(
					projectId,
					session.entry.sessionId,
					tool.toolUseId,
					tool.assistantUuid ?? null,
					tool.toolName,
					tool.caller ?? null,
					tool.inputJson,
					tool.resultText ?? null,
					toSqlBoolean(tool.isError)
				);
			}

			for (const event of session.progressEvents) {
				insertProgressStatement.run(
					projectId,
					session.entry.sessionId,
					event.recordIndex,
					event.uuid ?? null,
					event.timestamp ?? null,
					event.progressType ?? null,
					event.label ?? null,
					event.payloadJson ?? null
				);
			}

			for (const fileFact of session.fileFacts) {
				insertFileStatement.run(
					projectId,
					session.entry.sessionId,
					fileFact.recordIndex,
					fileFact.path,
					fileFact.kind
				);
			}
		}

		database.exec('COMMIT');
	} catch (error) {
		database.exec('ROLLBACK');
		throw error;
	}
}

export function deleteIndexedProjects(projectIds: string[]): void {
	if (projectIds.length === 0) return;

	const database = getDatabase();
	const deleteProjectStatement = database.prepare(`DELETE FROM projects WHERE id = ?`);

	database.exec('BEGIN IMMEDIATE');
	try {
		for (const projectId of projectIds) {
			deleteProjectStatement.run(projectId);
		}
		database.exec('COMMIT');
	} catch (error) {
		database.exec('ROLLBACK');
		throw error;
	}
}

export function updateIndexedSessionSummary(
	projectId: string,
	sessionId: string,
	summary: string
): void {
	const database = getDatabase();
	database
		.prepare(`UPDATE sessions SET summary = ? WHERE project_id = ? AND session_id = ?`)
		.run(summary, projectId, sessionId);
}

function getDatabase(): Database.Database {
	if (database) return database;

	mkdirSync(getInspectorDataDir(), { recursive: true });
	database = new Database(getSessionIndexDbPath());
	database.pragma('foreign_keys = ON');
	database.pragma('journal_mode = WAL');
	ensureSchema(database);
	return database;
}

function ensureSchema(database: Database.Database): void {
	const version = database.pragma('user_version', { simple: true });
	if (typeof version === 'number' && version === SESSION_INDEX_DB_VERSION) return;

	database.exec(`
		DROP TABLE IF EXISTS session_files;
		DROP TABLE IF EXISTS session_progress;
		DROP TABLE IF EXISTS session_tools;
		DROP TABLE IF EXISTS reconcile_state;
		DROP TABLE IF EXISTS sessions;
		DROP TABLE IF EXISTS projects;

		CREATE TABLE projects (
			id TEXT PRIMARY KEY,
			display_name TEXT NOT NULL,
			path TEXT NOT NULL,
			session_count INTEGER NOT NULL DEFAULT 0,
			last_modified TEXT NOT NULL,
			updated_at TEXT NOT NULL
		);

		CREATE TABLE sessions (
			project_id TEXT NOT NULL,
			session_id TEXT NOT NULL,
			display_session_id TEXT,
			full_path TEXT NOT NULL UNIQUE,
			relative_path TEXT,
			file_mtime INTEGER NOT NULL,
			size_bytes INTEGER NOT NULL,
			first_prompt TEXT NOT NULL,
			summary TEXT NOT NULL,
			message_count INTEGER NOT NULL,
			created TEXT NOT NULL,
			modified TEXT NOT NULL,
			git_branch TEXT NOT NULL,
			project_path TEXT NOT NULL,
			is_sidechain INTEGER NOT NULL DEFAULT 0,
			is_subagent INTEGER NOT NULL DEFAULT 0,
			parent_session_id TEXT,
			custom_title TEXT,
			native_summary TEXT,
			last_prompt TEXT,
			token_input INTEGER NOT NULL DEFAULT 0,
			token_output INTEGER NOT NULL DEFAULT 0,
			token_cache_read INTEGER NOT NULL DEFAULT 0,
			token_cache_write INTEGER NOT NULL DEFAULT 0,
			has_api_error INTEGER NOT NULL DEFAULT 0,
			has_compaction INTEGER NOT NULL DEFAULT 0,
			PRIMARY KEY (project_id, session_id),
			FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
		);

		CREATE INDEX idx_sessions_project_modified
			ON sessions(project_id, modified DESC);

		CREATE TABLE reconcile_state (
			file_path TEXT PRIMARY KEY,
			project_id TEXT NOT NULL,
			session_id TEXT NOT NULL,
			size_bytes INTEGER NOT NULL,
			mtime_ms INTEGER NOT NULL,
			indexed_at TEXT NOT NULL,
			FOREIGN KEY (project_id, session_id)
				REFERENCES sessions(project_id, session_id)
				ON DELETE CASCADE
		);

		CREATE INDEX idx_reconcile_state_project
			ON reconcile_state(project_id);

		CREATE TABLE session_tools (
			project_id TEXT NOT NULL,
			session_id TEXT NOT NULL,
			tool_use_id TEXT NOT NULL,
			assistant_uuid TEXT,
			tool_name TEXT NOT NULL,
			caller TEXT,
			input_json TEXT,
			result_text TEXT,
			is_error INTEGER NOT NULL DEFAULT 0,
			PRIMARY KEY (project_id, session_id, tool_use_id),
			FOREIGN KEY (project_id, session_id)
				REFERENCES sessions(project_id, session_id)
				ON DELETE CASCADE
		);

		CREATE TABLE session_progress (
			project_id TEXT NOT NULL,
			session_id TEXT NOT NULL,
			record_idx INTEGER NOT NULL,
			uuid TEXT,
			timestamp TEXT,
			progress_type TEXT,
			label TEXT,
			payload_json TEXT,
			PRIMARY KEY (project_id, session_id, record_idx),
			FOREIGN KEY (project_id, session_id)
				REFERENCES sessions(project_id, session_id)
				ON DELETE CASCADE
		);

		CREATE TABLE session_files (
			project_id TEXT NOT NULL,
			session_id TEXT NOT NULL,
			record_idx INTEGER NOT NULL,
			path TEXT NOT NULL,
			kind TEXT NOT NULL,
			PRIMARY KEY (project_id, session_id, record_idx, path),
			FOREIGN KEY (project_id, session_id)
				REFERENCES sessions(project_id, session_id)
				ON DELETE CASCADE
		);
	`);

	database.pragma(`user_version = ${SESSION_INDEX_DB_VERSION}`);
}

function rowToSessionEntry(row: SessionRow): SessionEntry {
	return {
		sessionId: row.session_id,
		displaySessionId: row.display_session_id ?? undefined,
		fullPath: row.full_path,
		relativePath: row.relative_path ?? undefined,
		fileMtime: row.file_mtime,
		firstPrompt: row.first_prompt,
		summary: row.summary,
		messageCount: row.message_count,
		created: row.created,
		modified: row.modified,
		gitBranch: row.git_branch,
		projectPath: row.project_path,
		isSidechain: row.is_sidechain === 1,
		isSubagent: row.is_subagent === 1 ? true : undefined,
		parentSessionId: row.parent_session_id ?? undefined,
		customTitle: row.custom_title ?? undefined,
		nativeSummary: row.native_summary ?? undefined,
		lastPrompt: row.last_prompt ?? undefined
	};
}

function toSqlRows(rows: unknown): SqlRow[] {
	if (!Array.isArray(rows)) return [];
	return rows.filter((row): row is SqlRow => Boolean(row) && typeof row === 'object');
}

function toProjectRow(row: SqlRow): ProjectRow {
	return {
		id: requireString(row, 'id'),
		display_name: requireString(row, 'display_name'),
		path: requireString(row, 'path'),
		session_count: requireNumber(row, 'session_count'),
		last_modified: requireString(row, 'last_modified')
	};
}

function toSessionRow(row: SqlRow): SessionRow {
	return {
		project_id: requireString(row, 'project_id'),
		session_id: requireString(row, 'session_id'),
		display_session_id: optionalString(row, 'display_session_id'),
		full_path: requireString(row, 'full_path'),
		relative_path: optionalString(row, 'relative_path'),
		file_mtime: requireNumber(row, 'file_mtime'),
		size_bytes: requireNumber(row, 'size_bytes'),
		first_prompt: requireString(row, 'first_prompt'),
		summary: requireString(row, 'summary'),
		message_count: requireNumber(row, 'message_count'),
		created: requireString(row, 'created'),
		modified: requireString(row, 'modified'),
		git_branch: requireString(row, 'git_branch'),
		project_path: requireString(row, 'project_path'),
		is_sidechain: requireNumber(row, 'is_sidechain'),
		is_subagent: requireNumber(row, 'is_subagent'),
		parent_session_id: optionalString(row, 'parent_session_id'),
		custom_title: optionalString(row, 'custom_title'),
		native_summary: optionalString(row, 'native_summary'),
		last_prompt: optionalString(row, 'last_prompt'),
		token_input: requireNumber(row, 'token_input'),
		token_output: requireNumber(row, 'token_output'),
		token_cache_read: requireNumber(row, 'token_cache_read'),
		token_cache_write: requireNumber(row, 'token_cache_write'),
		has_api_error: requireNumber(row, 'has_api_error'),
		has_compaction: requireNumber(row, 'has_compaction')
	};
}

function toReconcileStateRow(row: SqlRow): ReconcileStateRow {
	return {
		file_path: requireString(row, 'file_path'),
		session_id: requireString(row, 'session_id'),
		size_bytes: requireNumber(row, 'size_bytes'),
		mtime_ms: requireNumber(row, 'mtime_ms')
	};
}

function flattenContent(content: string | ClaudeContentBlock[] | undefined): string | undefined {
	if (typeof content === 'string') {
		const trimmed = content.trim();
		return trimmed || undefined;
	}

	if (!Array.isArray(content)) {
		return undefined;
	}

	const flattened = content
		.map((block) => {
			switch (block.type) {
				case 'text':
					return block.text;
				case 'thinking':
					return block.thinking;
				case 'tool_result':
					return flattenContent(block.content) || '';
				default:
					return '';
			}
		})
		.filter(Boolean)
		.join('\n')
		.trim();

	return flattened || undefined;
}

function readUsageNumber(usage: unknown, keys: string[]): number {
	if (!usage || typeof usage !== 'object') return 0;

	for (const key of keys) {
		const value = (usage as Record<string, unknown>)[key];
		const numberValue = asNumber(value);
		if (numberValue !== undefined) {
			return numberValue;
		}
	}

	return 0;
}

function asString(value: unknown): string | undefined {
	return typeof value === 'string' && value.trim() ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
	return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function toJson(value: unknown): string | undefined {
	if (value === undefined) return undefined;
	return JSON.stringify(value);
}

function toSqlBoolean(value: boolean): number {
	return value ? 1 : 0;
}

function requireString(row: SqlRow, key: string): string {
	const value = row[key];
	return typeof value === 'string' ? value : '';
}

function optionalString(row: SqlRow, key: string): string | null {
	const value = row[key];
	return typeof value === 'string' ? value : null;
}

function requireNumber(row: SqlRow, key: string): number {
	const value = row[key];
	return typeof value === 'number' ? value : 0;
}
