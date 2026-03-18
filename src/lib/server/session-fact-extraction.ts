/**
 * @module
 * Pure fact-extraction logic for building the session index.
 * Walks parsed JSONL records to extract tool usage, progress events,
 * file-history paths, token totals, and text fragments for FTS indexing.
 * Has no SQLite dependency — all output is passed to the DB layer for persistence.
 */

import type { Stats } from 'fs';
import type { SessionEntry } from '../types.js';
import type { SessionFileDescriptor } from './session-discovery.js';
import type {
	IndexedFileFact,
	IndexedProgressFact,
	IndexedSearchDocument,
	IndexedSessionData,
	IndexedToolFact,
	TokenUsage
} from './session-index-types.js';
import { extractSessionEntry } from './session-metadata.js';
import {
	extractTextFromMessageContent,
	isAssistantRecord,
	isToolResultRecord,
	isUserRecord,
	type AssistantRecord,
	type ClaudeContentBlock,
	type ParsedSessionRecord,
	type ToolResultRecord,
	type UserRecord
} from './session-schema.js';

/** Indexed view of a tool result block before it is paired back onto a tool call. */
interface ToolResultFact {
	resultText?: string;
	isError: boolean;
}

interface RecordFacts {
	toolResults: Map<string, ToolResultFact>;
	tools: Map<string, IndexedToolFact>;
	progressEvents: IndexedProgressFact[];
	fileFacts: IndexedFileFact[];
	bodyTextParts: string[];
	toolTextParts: Set<string>;
	systemTextParts: string[];
	latestAssistantRecords: Map<string, { record: AssistantRecord; recordIndex: number }>;
	hasApiError: boolean;
	hasCompaction: boolean;
}

/**
 * Builds the enriched index payload for one parsed session file.
 * Combines the lightweight `SessionEntry` metadata with extracted facts,
 * token totals, search text, and error/compaction flags.
 */
export function buildIndexedSessionData(
	descriptor: SessionFileDescriptor,
	records: ParsedSessionRecord[],
	fileStat: Stats
): IndexedSessionData | null {
	const entry = extractSessionEntry(descriptor, records, fileStat);
	if (!entry) return null;

	const facts = collectRecordFacts(records);
	const usage = aggregateTokenUsage(facts.latestAssistantRecords);
	const searchDocument = buildSearchDocument(
		entry,
		facts.bodyTextParts,
		facts.toolTextParts,
		facts.systemTextParts
	);

	return {
		entry,
		sizeBytes: fileStat.size,
		...usage,
		hasApiError: facts.hasApiError,
		hasCompaction: facts.hasCompaction,
		tools: [...facts.tools.values()],
		progressEvents: facts.progressEvents,
		fileFacts: facts.fileFacts,
		searchDocument
	};
}

/**
 * Extracts the interdependent "facts" that power indexing and structured search.
 * A fact is any derived session signal worth querying later: tool usage/results,
 * progress events, file-history paths, deduplicated assistant usage stats, and
 * the text fragments that feed the FTS search document.
 */
function collectRecordFacts(records: ParsedSessionRecord[]): RecordFacts {
	const toolResults = new Map<string, ToolResultFact>();
	const tools = new Map<string, IndexedToolFact>();
	const progressEvents: IndexedProgressFact[] = [];
	const fileFacts: IndexedFileFact[] = [];
	const bodyTextParts: string[] = [];
	const toolTextParts = new Set<string>();
	const systemTextParts: string[] = [];
	const latestAssistantRecords = new Map<
		string,
		{ record: AssistantRecord; recordIndex: number }
	>();

	let hasApiError = false;
	let hasCompaction = false;

	for (const parsedRecord of records) {
		const { record, source } = parsedRecord;

		collectQueueOperationFacts(record, systemTextParts, { hasCompaction });
		if (record.type === 'queue-operation' && record.operation?.toLowerCase().includes('compact')) {
			hasCompaction = true;
		}

		collectFileHistoryFacts(record, source, fileFacts, systemTextParts);

		if (record.type === 'progress') {
			collectProgressFact(record, source, progressEvents, systemTextParts);
			continue;
		}

		if (record.type === 'system') {
			({ hasApiError, hasCompaction } = collectSystemFact(
				record,
				systemTextParts,
				hasApiError,
				hasCompaction
			));
			continue;
		}

		if (isToolResultRecord(record)) {
			hasCompaction = collectToolResultFact(record, toolResults, hasCompaction);
			continue;
		}

		if (isUserRecord(record)) {
			hasCompaction = collectUserMessageFact(record, bodyTextParts, hasCompaction);
			continue;
		}

		if (!isAssistantRecord(record)) continue;

		hasApiError = collectAssistantFact(
			record,
			source,
			latestAssistantRecords,
			bodyTextParts,
			tools,
			toolResults,
			toolTextParts,
			hasApiError
		);
	}

	return {
		toolResults,
		tools,
		progressEvents,
		fileFacts,
		bodyTextParts,
		toolTextParts,
		systemTextParts,
		latestAssistantRecords,
		hasApiError,
		hasCompaction
	};
}

function collectQueueOperationFacts(
	record: ParsedSessionRecord['record'],
	systemTextParts: string[],
	_flags: { hasCompaction: boolean }
): void {
	if (record.type !== 'queue-operation') return;

	const queueText = [
		record.operation,
		typeof record.content === 'string' ? record.content : undefined
	]
		.filter(Boolean)
		.join(' ')
		.trim();
	if (queueText) {
		systemTextParts.push(queueText);
	}
}

function collectFileHistoryFacts(
	record: ParsedSessionRecord['record'],
	source: ParsedSessionRecord['source'],
	fileFacts: IndexedFileFact[],
	systemTextParts: string[]
): void {
	if (record.type !== 'file-history-snapshot' || !record.snapshot) return;

	for (const filePath of Object.keys(record.snapshot)) {
		fileFacts.push({
			recordIndex: source.recordIndex,
			path: filePath,
			kind: record.isSnapshotUpdate ? 'file-history-update' : 'file-history-snapshot'
		});
		systemTextParts.push(filePath);
	}
}

function collectProgressFact(
	record: Extract<ParsedSessionRecord['record'], { type: 'progress' }>,
	source: ParsedSessionRecord['source'],
	progressEvents: IndexedProgressFact[],
	systemTextParts: string[]
): void {
	progressEvents.push({
		recordIndex: source.recordIndex,
		uuid: record.uuid,
		timestamp: record.timestamp,
		progressType: asString(record.data?.type),
		label: asString(record.data?.label) || asString(record.data?.output),
		payloadJson: toJson(record.data)
	});
	const progressText = [
		asString(record.data?.type),
		asString(record.data?.label),
		asString(record.data?.output)
	]
		.filter(Boolean)
		.join(' ')
		.trim();
	if (progressText) {
		systemTextParts.push(progressText);
	}
}

function collectSystemFact(
	record: Extract<ParsedSessionRecord['record'], { type: 'system' }>,
	systemTextParts: string[],
	prevApiError: boolean,
	prevCompaction: boolean
): { hasApiError: boolean; hasCompaction: boolean } {
	const hasApiError = prevApiError || record.subtype === 'api_error';
	const hasCompaction = prevCompaction || Boolean(record.compactMetadata);
	const systemText = [record.subtype, record.content].filter(Boolean).join(' ').trim();
	if (systemText) {
		systemTextParts.push(systemText);
	}
	return { hasApiError, hasCompaction };
}

function collectUserMessageFact(
	record: UserRecord,
	bodyTextParts: string[],
	prevCompaction: boolean
): boolean {
	const hasCompaction = prevCompaction || Boolean(record.isCompactSummary);

	const userText = extractTextFromMessageContent(record.message.content).trim();
	if (userText) {
		bodyTextParts.push(userText);
	}

	return hasCompaction;
}

function collectToolResultFact(
	record: ToolResultRecord,
	toolResults: Map<string, ToolResultFact>,
	prevCompaction: boolean
): boolean {
	const hasCompaction = prevCompaction || Boolean(record.isCompactSummary);

	if (Array.isArray(record.message.content)) {
		for (const block of record.message.content) {
			if (block.type !== 'tool_result' || !block.tool_use_id) continue;

			toolResults.set(block.tool_use_id, {
				resultText: flattenContent(block.content),
				isError: block.is_error ?? false
			});
		}
	}

	return hasCompaction;
}

function collectAssistantToolUses(
	record: AssistantRecord,
	tools: Map<string, IndexedToolFact>,
	toolResults: Map<string, ToolResultFact>,
	toolTextParts: Set<string>
): void {
	if (!Array.isArray(record.message.content)) return;

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
		if (block.name) {
			toolTextParts.add(block.name);
		}
		if (block.caller) {
			toolTextParts.add(block.caller);
		}
	}
}

function collectAssistantFact(
	record: AssistantRecord,
	source: ParsedSessionRecord['source'],
	latestAssistantRecords: Map<string, { record: AssistantRecord; recordIndex: number }>,
	bodyTextParts: string[],
	tools: Map<string, IndexedToolFact>,
	toolResults: Map<string, ToolResultFact>,
	toolTextParts: Set<string>,
	prevApiError: boolean
): boolean {
	const hasApiError =
		prevApiError || Boolean(record.isApiErrorMessage || record.apiError || record.error);

	const assistantMessageKey = record.message.id || record.uuid;
	const previousAssistant = latestAssistantRecords.get(assistantMessageKey);
	if (!previousAssistant || previousAssistant.recordIndex < source.recordIndex) {
		latestAssistantRecords.set(assistantMessageKey, { record, recordIndex: source.recordIndex });
	}

	const assistantText = extractTextFromMessageContent(record.message.content).trim();
	if (assistantText) {
		bodyTextParts.push(assistantText);
	}

	collectAssistantToolUses(record, tools, toolResults, toolTextParts);

	return hasApiError;
}

function aggregateTokenUsage(
	latestAssistantRecords: Map<string, { record: AssistantRecord; recordIndex: number }>
): TokenUsage {
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

	return { tokenInput, tokenOutput, tokenCacheRead, tokenCacheWrite };
}

function buildSearchDocument(
	entry: SessionEntry,
	bodyTextParts: string[],
	toolTextParts: Set<string>,
	systemTextParts: string[]
): IndexedSearchDocument {
	return {
		titleText: [entry.summary, entry.customTitle, entry.nativeSummary].filter(Boolean).join('\n'),
		promptText: [entry.firstPrompt, entry.lastPrompt].filter(Boolean).join('\n'),
		bodyText: bodyTextParts.join('\n'),
		toolText: [...toolTextParts].join('\n'),
		branchText: entry.gitBranch,
		systemText: systemTextParts.join('\n')
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
