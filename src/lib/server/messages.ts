import { createReadStream } from 'fs';
import { createInterface } from 'readline';
import type { ThreadMessage, ContentBlock, ToolCall } from '$lib/types.js';

/**
 * Parses a session JSONL file into an ordered list of threaded messages.
 * Handles parentUuid threading, tool_use/tool_result pairing, and thinking block extraction.
 * Uses stream parsing via readline to handle large files without loading them entirely into memory.
 */
export async function parseSessionMessages(filePath: string): Promise<ThreadMessage[]> {
	const records: Array<{
		uuid: string;
		parentUuid: string | null;
		type: string;
		timestamp: string;
		message: { role: string; content: string | ContentBlock[]; model?: string };
		isSidechain?: boolean;
	}> = [];

	const rl = createInterface({
		input: createReadStream(filePath),
		crlfDelay: Infinity
	});

	for await (const line of rl) {
		try {
			const record = JSON.parse(line);
			if (
				(record.type === 'user' || record.type === 'assistant') &&
				record.message &&
				!record.isSidechain
			) {
				records.push(record);
			}
		} catch {
			continue;
		}
	}

	// Build thread: follow parentUuid chain
	const byUuid = new Map(records.map((r) => [r.uuid, r]));

	// Find root messages (no parent or parent not in set)
	const roots = records.filter((r) => !r.parentUuid || !byUuid.has(r.parentUuid));

	// Build ordered chain
	const ordered: typeof records = [];
	const childMap = new Map<string, typeof records>();

	for (const r of records) {
		if (r.parentUuid) {
			const children = childMap.get(r.parentUuid) || [];
			children.push(r);
			childMap.set(r.parentUuid, children);
		}
	}

	// BFS from roots
	const visited = new Set<string>();
	const queue = [...roots];

	while (queue.length > 0) {
		const current = queue.shift();
		if (!current) break;
		if (visited.has(current.uuid)) continue;
		visited.add(current.uuid);
		ordered.push(current);

		const children = childMap.get(current.uuid) || [];
		// Sort children by timestamp
		children.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
		queue.push(...children);
	}

	// Collect tool results from user messages
	const toolResultMap = new Map<string, { content: string | ContentBlock[]; isError: boolean }>();

	for (const record of ordered) {
		if (record.message.role === 'user' && Array.isArray(record.message.content)) {
			for (const block of record.message.content as ContentBlock[]) {
				if (block.type === 'tool_result' && block.tool_use_id) {
					toolResultMap.set(block.tool_use_id, {
						content: block.content || '',
						isError: block.is_error || false
					});
				}
			}
		}
	}

	// Convert to ThreadMessages
	const messages: ThreadMessage[] = [];

	for (const record of ordered) {
		const { role, content, model } = record.message;

		if (role === 'user') {
			const textContent = extractTextContent(content);
			// Skip messages that are only tool results
			if (!textContent && Array.isArray(content)) {
				const hasOnlyToolResults = (content as ContentBlock[]).every(
					(b) => b.type === 'tool_result'
				);
				if (hasOnlyToolResults) continue;
			}

			messages.push({
				uuid: record.uuid,
				role: 'user',
				timestamp: record.timestamp,
				textContent,
				toolCalls: [],
				toolResults: new Map(),
				thinkingBlocks: [],
				rawContent: content,
				model: undefined
			});
		} else if (role === 'assistant') {
			const toolCalls: ToolCall[] = [];
			const thinkingBlocks: string[] = [];
			const textParts: string[] = [];

			if (Array.isArray(content)) {
				for (const block of content as ContentBlock[]) {
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

			messages.push({
				uuid: record.uuid,
				role: 'assistant',
				timestamp: record.timestamp,
				textContent: textParts.join('\n'),
				toolCalls,
				toolResults: new Map(),
				thinkingBlocks,
				rawContent: content,
				model
			});
		}
	}

	return messages;
}

function extractTextContent(content: string | ContentBlock[]): string {
	if (typeof content === 'string') return content;
	if (!Array.isArray(content)) return '';

	return content
		.filter((b) => b.type === 'text' && b.text)
		.map((b) => b.text ?? '')
		.join('\n');
}
