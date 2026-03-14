import type { ContentBlock, ThreadMessage, ToolCall } from '../types.js';
import {
	extractTextFromMessageContent,
	isApiUserRecord,
	isAssistantRecord,
	isUserRecord,
	type AssistantRecord,
	type ClaudeContentBlock,
	type ClaudeMessageContent,
	type ParsedSessionRecord,
	type ToolResultRecord,
	type UserRecord
} from './session-schema.js';

type TranscriptRecord = UserRecord | ToolResultRecord | AssistantRecord;

type ToolResultMap = Map<string, { content: string | ContentBlock[]; isError: boolean }>;

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
	toolResultMap: ToolResultMap
): AssistantContentParts {
	const textParts: string[] = [];
	const toolCalls: ToolCall[] = [];
	const thinkingBlocks: string[] = [];

	if (Array.isArray(content)) {
		for (const block of content) {
			if (block.type === 'text' && block.text) {
				textParts.push(block.text);
			} else if (block.type === 'tool_use' && block.id) {
				const result = toolResultMap.get(block.id);
				toolCalls.push({
					id: block.id,
					name: block.name || 'unknown',
					input: block.input || {},
					result: result?.content,
					isError: result?.isError
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
	toolResultMap: ToolResultMap
): ThreadMessage | null {
	const { textParts, toolCalls, thinkingBlocks } = extractAssistantContentParts(
		record.message.content,
		toolResultMap
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
	const messages: ThreadMessage[] = [];

	for (const record of ordered) {
		if (isUserRecord(record)) {
			const message = convertUserRecord(record);
			if (message) messages.push(message);
			continue;
		}

		if (isAssistantRecord(record)) {
			const message = convertAssistantRecord(record, toolResultMap);
			if (message) messages.push(message);
		}
		// ToolResultRecords are skipped — already consumed by toolResultMap
	}

	return messages;
}

function toSharedToolResultContent(
	content: string | ClaudeContentBlock[] | undefined
): string | ContentBlock[] {
	if (typeof content === 'string') return content;
	if (!Array.isArray(content)) return '';
	return toSharedContentBlocks(content);
}

function toSharedMessageContent(content: ClaudeMessageContent): string | ContentBlock[] {
	if (typeof content === 'string') return content;
	return toSharedContentBlocks(content);
}

function toSharedContentBlocks(content: ClaudeContentBlock[]): ContentBlock[] {
	return content
		.map((block) => toSharedContentBlock(block))
		.filter((block): block is ContentBlock => block !== null);
}

function toSharedContentBlock(block: ClaudeContentBlock): ContentBlock | null {
	switch (block.type) {
		case 'text':
			return {
				type: 'text',
				text: block.text
			};
		case 'tool_use':
			return {
				type: 'tool_use',
				id: block.id,
				name: block.name,
				input: block.input,
				caller: block.caller
			};
		case 'tool_result':
			return toSharedToolResultBlock(block);
		case 'thinking':
			return {
				type: 'thinking',
				thinking: block.thinking,
				signature: block.signature
			};
		case 'image':
			return {
				type: 'image',
				source: block.source
			};
		default:
			return null;
	}
}

function toSharedToolResultBlock(
	block: ClaudeContentBlock & { type: 'tool_result' }
): ContentBlock {
	if (typeof block.content === 'string') {
		return {
			type: 'tool_result',
			tool_use_id: block.tool_use_id,
			content: block.content,
			is_error: block.is_error
		};
	}

	if (Array.isArray(block.content)) {
		return {
			type: 'tool_result',
			tool_use_id: block.tool_use_id,
			content: toSharedContentBlocks(block.content),
			is_error: block.is_error
		};
	}

	return {
		type: 'tool_result',
		tool_use_id: block.tool_use_id,
		content: undefined,
		is_error: block.is_error
	};
}
