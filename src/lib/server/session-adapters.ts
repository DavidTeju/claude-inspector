/**
 * @module
 * Adapters that convert normalized session-schema records into the shared
 * transcript model consumed by the current Inspector UI. This is the bridge
 * between the raw schema-layer `ClaudeContentBlock` types that mirror JSONL on
 * disk and the frontend `ContentBlock` union that uses camelCase Inspector
 * field names and omits unknown block variants.
 */

import type { ContentBlock, ThreadMessage, ToolCall, ToolResultMap } from '../types.js';
import { parseSessionFile } from './session-parser.js';
import {
	extractTextFromMessageContent,
	isApiUserRecord,
	isAssistantRecord,
	isToolResultRecord,
	isUserRecord,
	normalizeContentBlock,
	type AssistantRecord,
	type ClaudeContentBlock,
	type ClaudeMessageContent,
	type ParsedSessionRecord,
	type ToolResultRecord,
	type UserRecord
} from './session-schema.js';

type TranscriptRecord = UserRecord | ToolResultRecord | AssistantRecord;

/**
 * Orders transcript records by parent/child relationships before final timestamp sorting.
 * This preserves branching conversation structure so resumed turns and subtrees stay
 * grouped instead of blindly following file order.
 */
function orderRecordsByTree(transcriptRecords: TranscriptRecord[]): TranscriptRecord[] {
	const byUuid = new Map(transcriptRecords.map((record) => [record.uuid, record]));
	const roots = transcriptRecords.filter(
		(record) => !record.parentUuid || !byUuid.has(record.parentUuid)
	);
	const childMap = new Map<string, TranscriptRecord[]>();

	for (const record of transcriptRecords) {
		if (!record.parentUuid) continue;

		const children = childMap.get(record.parentUuid) || [];
		children.push(record);
		childMap.set(record.parentUuid, children);
	}

	const ordered: TranscriptRecord[] = [];
	const visited = new Set<string>();
	const queue = [...roots];

	while (queue.length > 0) {
		const current = queue.shift();
		if (!current || visited.has(current.uuid)) continue;

		visited.add(current.uuid);
		ordered.push(current);

		const children = childMap.get(current.uuid) || [];
		children.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
		queue.push(...children);
	}

	ordered.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
	return ordered;
}

/**
 * Collects tool results ahead of assistant conversion so `tool_use` blocks can be paired
 * with their eventual `tool_result` payloads even when they arrive in later user records.
 */
function buildToolResultMap(ordered: TranscriptRecord[]): ToolResultMap {
	const toolResultMap: ToolResultMap = new Map();

	for (const record of ordered) {
		if (!isApiUserRecord(record) || !Array.isArray(record.message.content)) continue;

		for (const block of record.message.content) {
			if (block.type !== 'tool_result' || !block.tool_use_id) continue;

			toolResultMap.set(block.tool_use_id, {
				content: toSharedToolResultContent(block.content),
				isError: block.is_error ?? false
			});
		}
	}

	return toolResultMap;
}

/**
 * Maps Skill `tool_use` IDs to the expanded prompt text from the `isMeta` user
 * record that the SDK injects immediately after the Skill tool result. The link
 * is temporal: after each Skill tool_use / tool_result pair the SDK emits an
 * `isMeta: true` user record carrying the full prompt expansion (no
 * `tool_use_id` on that record). We walk the ordered timeline and match pending
 * Skill IDs to the next qualifying isMeta record in FIFO order.
 */
function collectSkillToolUseIds(content: ClaudeMessageContent): string[] {
	if (!Array.isArray(content)) return [];
	const ids: string[] = [];
	for (const block of content) {
		if (block.type === 'tool_use' && block.name === 'Skill') {
			ids.push(block.id);
		}
	}
	return ids;
}

function buildSkillExpansionMap(ordered: TranscriptRecord[]): Map<string, string> {
	const expansionMap = new Map<string, string>();
	const pendingSkillIds: string[] = [];

	for (const record of ordered) {
		if (isAssistantRecord(record)) {
			pendingSkillIds.push(...collectSkillToolUseIds(record.message.content));
		} else if (pendingSkillIds.length > 0 && isToolResultRecord(record) && record.isMeta) {
			// The SDK emits the isMeta expansion immediately after the Skill tool_result.
			// Non-skill isMeta records (plan-mode exits, local-command caveats) are short
			// signals that don't occur mid-Skill invocation, so FIFO matching is safe here.
			const text = extractTextFromMessageContent(record.message.content);
			if (text) {
				const skillId = pendingSkillIds.shift();
				if (skillId) expansionMap.set(skillId, text);
			}
		}
	}

	return expansionMap;
}

function convertUserRecord(record: UserRecord): ThreadMessage | null {
	const textContent = extractTextFromMessageContent(record.message.content);
	const rawContent = toSharedMessageContent(record.message.content);

	return {
		uuid: record.uuid,
		role: 'user',
		timestamp: record.timestamp,
		textContent,
		toolCalls: [],
		thinkingBlocks: [],
		rawContent,
		model: undefined
	};
}

interface AssistantContentParts {
	textParts: string[];
	toolCalls: ToolCall[];
	thinkingBlocks: string[];
}

function extractAssistantContentParts(
	content: ClaudeMessageContent,
	toolResultMap: ToolResultMap,
	skillExpansionMap: Map<string, string>
): AssistantContentParts {
	const textParts: string[] = [];
	const toolCalls: ToolCall[] = [];
	const thinkingBlocks: string[] = [];

	if (Array.isArray(content)) {
		for (const block of content) {
			if (block.type === 'text' && block.text) {
				textParts.push(block.text);
			} else if (block.type === 'tool_use' && block.id) {
				toolCalls.push({
					id: block.id,
					name: block.name,
					input: block.input,
					result: toolResultMap.get(block.id),
					skillExpansion: skillExpansionMap.get(block.id)
				});
			} else if (block.type === 'thinking' && block.thinking) {
				thinkingBlocks.push(block.thinking);
			}
		}
	} else if (typeof content === 'string') {
		textParts.push(content);
	}

	return { textParts, toolCalls, thinkingBlocks };
}

function convertAssistantRecord(
	record: AssistantRecord,
	toolResultMap: ToolResultMap,
	skillExpansionMap: Map<string, string>
): ThreadMessage | null {
	const { textParts, toolCalls, thinkingBlocks } = extractAssistantContentParts(
		record.message.content,
		toolResultMap,
		skillExpansionMap
	);

	const textContent = textParts.join('\n').trim();
	if (!textContent && toolCalls.length === 0 && thinkingBlocks.length === 0) {
		return null;
	}

	return {
		uuid: record.uuid,
		role: 'assistant',
		timestamp: record.timestamp,
		textContent,
		toolCalls,
		thinkingBlocks,
		rawContent: toSharedMessageContent(record.message.content),
		model: record.message.model
	};
}

/**
 * Converts parsed session records into display-ready thread messages.
 * Sidechain records are hidden by default because they represent Claude's
 * auxiliary execution path rather than the main user-visible transcript.
 */
export function toThreadMessages(
	records: ParsedSessionRecord[],
	{ includeSidechain = false }: { includeSidechain?: boolean } = {}
): ThreadMessage[] {
	const transcriptRecords: TranscriptRecord[] = records
		.map(({ record }) => record)
		.filter(
			(record): record is TranscriptRecord =>
				(isApiUserRecord(record) || isAssistantRecord(record)) &&
				(includeSidechain || record.isSidechain !== true)
		);

	const ordered = orderRecordsByTree(transcriptRecords);
	const toolResultMap = buildToolResultMap(ordered);
	const skillExpansionMap = buildSkillExpansionMap(ordered);
	const messages: ThreadMessage[] = [];

	for (const record of ordered) {
		if (isUserRecord(record)) {
			const message = convertUserRecord(record);
			if (message) messages.push(message);
			continue;
		}

		if (isAssistantRecord(record)) {
			const message = convertAssistantRecord(record, toolResultMap, skillExpansionMap);
			if (message) messages.push(message);
		}
		// ToolResultRecords are skipped — already consumed by toolResultMap
	}

	return messages;
}

/**
 * Convert raw content (unknown) to the shared ContentBlock union.
 * Normalizes through the session-schema parser, then maps known
 * `ClaudeContentBlock` variants into the frontend `ContentBlock` union.
 */
export function toSharedContent(value: unknown): string | ContentBlock[] {
	if (typeof value === 'string') return value;
	if (!Array.isArray(value)) return '';

	return value
		.map(normalizeContentBlock)
		.filter((b): b is ClaudeContentBlock => b !== null)
		.map(toSharedContentBlock)
		.filter((b): b is ContentBlock => b !== null);
}

function toSharedToolResultContent(
	content: string | ClaudeContentBlock[] | undefined
): string | ContentBlock[] {
	if (typeof content === 'string') return content;
	if (!Array.isArray(content)) return '';
	return toSharedContentBlocks(content);
}

/**
 * Preserves message content in the shared camel-cased format used by the UI.
 * Returns `string | ContentBlock[]` to match both shapes found in persisted
 * Claude transcripts.
 */
function toSharedMessageContent(content: ClaudeMessageContent): string | ContentBlock[] {
	if (typeof content === 'string') return content;
	return toSharedContentBlocks(content);
}

function toSharedContentBlocks(content: ClaudeContentBlock[]): ContentBlock[] {
	return content.map(toSharedContentBlock).filter((b): b is ContentBlock => b !== null);
}

function convertToolResultContent(
	content: string | ClaudeContentBlock[] | undefined
): string | ContentBlock[] | undefined {
	if (typeof content === 'string') return content;
	if (!Array.isArray(content)) return undefined;
	return toSharedContentBlocks(content);
}

/**
 * Maps one normalized schema-layer content block into the shared UI union.
 * This is the snake_case-to-camelCase bridge between `ClaudeContentBlock` and
 * `ContentBlock`. Unknown block variants return null so forward-compatible
 * parser output does not break transcript rendering when Claude introduces new
 * block types before the UI adds support for them.
 */
function toSharedContentBlock(block: ClaudeContentBlock): ContentBlock | null {
	switch (block.type) {
		case 'text':
			return { type: 'text', text: block.text };
		case 'tool_use':
			return {
				type: 'tool_use',
				id: block.id,
				name: block.name,
				input: block.input,
				caller: block.caller
			};
		case 'tool_result':
			return {
				type: 'tool_result',
				toolUseId: block.tool_use_id,
				content: convertToolResultContent(block.content),
				isError: block.is_error
			};
		case 'thinking':
			return {
				type: 'thinking',
				thinking: block.thinking,
				signature: block.signature
			};
		case 'image':
			return {
				type: 'image',
				source: {
					type: block.source.type,
					mediaType: block.source.media_type,
					data: block.source.data
				}
			};
		default:
			return null;
	}
}

/**
 * Parses a session JSONL file into the compatibility transcript model used by the current UI.
 */
export async function parseSessionMessages(
	filePath: string,
	options?: { includeSidechain?: boolean }
): Promise<ThreadMessage[]> {
	const records = await parseSessionFile(filePath);
	return toThreadMessages(records, options);
}
