import { describe, expect, it } from 'vitest';
import {
	extractTextFromMessageContent,
	isApiUserRecord,
	isAssistantRecord,
	isThreadRecord,
	isToolResultRecord,
	isUserRecord,
	normalizeContentBlock,
	parseSessionRecordValue
} from './session-schema.js';

function createThreadRecordBase() {
	return {
		uuid: 'uuid-1',
		parentUuid: null,
		sessionId: 'session-1',
		timestamp: '2025-01-01T00:00:00.000Z'
	};
}

describe('server/session-schema', () => {
	describe('type guards', () => {
		it('identifies parsed user records', () => {
			const record = parseSessionRecordValue({
				...createThreadRecordBase(),
				type: 'user',
				message: { content: 'Hello' },
				promptId: 'prompt-1'
			});

			expect(record).not.toBeNull();
			expect(isThreadRecord(record!)).toBe(true);
			expect(isUserRecord(record!)).toBe(true);
			expect(isApiUserRecord(record!)).toBe(true);
			expect(isToolResultRecord(record!)).toBe(false);
			expect(isAssistantRecord(record!)).toBe(false);
		});

		it('identifies parsed tool result and assistant records', () => {
			const toolResult = parseSessionRecordValue({
				...createThreadRecordBase(),
				type: 'user',
				message: { content: [{ type: 'tool_result', tool_use_id: 'tool-1', content: 'done' }] }
			});
			const assistant = parseSessionRecordValue({
				...createThreadRecordBase(),
				type: 'assistant',
				message: { content: 'Hi', model: 'claude-sonnet-4-6' }
			});

			expect(toolResult).not.toBeNull();
			expect(isThreadRecord(toolResult!)).toBe(true);
			expect(isToolResultRecord(toolResult!)).toBe(true);
			expect(isUserRecord(toolResult!)).toBe(false);
			expect(isApiUserRecord(toolResult!)).toBe(true);

			expect(assistant).not.toBeNull();
			expect(isThreadRecord(assistant!)).toBe(true);
			expect(isAssistantRecord(assistant!)).toBe(true);
			expect(isUserRecord(assistant!)).toBe(false);
			expect(isToolResultRecord(assistant!)).toBe(false);
			expect(isApiUserRecord(assistant!)).toBe(false);
		});

		it('rejects metadata records from thread-only guards', () => {
			const record = parseSessionRecordValue({
				type: 'summary',
				summary: 'summary text'
			});

			expect(record).not.toBeNull();
			expect(isThreadRecord(record!)).toBe(false);
			expect(isUserRecord(record!)).toBe(false);
			expect(isToolResultRecord(record!)).toBe(false);
			expect(isApiUserRecord(record!)).toBe(false);
			expect(isAssistantRecord(record!)).toBe(false);
		});
	});

	describe('extractTextFromMessageContent', () => {
		it('returns text for strings and concatenates text blocks only', () => {
			expect(extractTextFromMessageContent('plain text')).toBe('plain text');
			expect(
				extractTextFromMessageContent([
					{ type: 'text', text: 'Hello' },
					{ type: 'tool_use', id: 'tool-1', name: 'Read', input: {} },
					{ type: 'text', text: ' world' }
				])
			).toBe('Hello world');
		});

		it('returns an empty string for unsupported values', () => {
			expect(extractTextFromMessageContent(undefined)).toBe('');
			expect(extractTextFromMessageContent([])).toBe('');
		});
	});

	describe('parseSessionRecordValue', () => {
		it('returns null for invalid top-level values', () => {
			expect(parseSessionRecordValue(null)).toBeNull();
			expect(parseSessionRecordValue({})).toBeNull();
			expect(parseSessionRecordValue({ type: 'unknown' })).toBeNull();
			expect(
				parseSessionRecordValue({
					type: 'assistant',
					sessionId: 'session-1',
					timestamp: '2025-01-01T00:00:00.000Z'
				})
			).toBeNull();
		});

		it('classifies direct tool result records from sourceToolUseID', () => {
			expect(
				parseSessionRecordValue({
					...createThreadRecordBase(),
					type: 'user',
					message: { content: 'Tool result payload' },
					sourceToolUseID: 'tool-1',
					sourceToolAssistantUUID: 'assistant-1'
				})
			).toMatchObject({
				type: 'user',
				recordKind: 'tool_result',
				sourceToolUseID: 'tool-1',
				sourceToolAssistantUUID: 'assistant-1'
			});
		});

		it('keeps image-only meta records visible when they have a prompt id', () => {
			expect(
				parseSessionRecordValue({
					...createThreadRecordBase(),
					type: 'user',
					message: {
						content: [
							{
								type: 'image',
								source: { type: 'base64', media_type: 'image/png', data: 'abc123' }
							}
						]
					},
					isMeta: true,
					promptId: 'prompt-1'
				})
			).toMatchObject({
				type: 'user',
				recordKind: 'user',
				isMeta: true
			});
		});

		it('treats image-only meta records without promptId as tool results', () => {
			expect(
				parseSessionRecordValue({
					...createThreadRecordBase(),
					type: 'user',
					message: {
						content: [
							{
								type: 'image',
								source: { type: 'base64', media_type: 'image/png', data: 'abc123' }
							}
						]
					},
					isMeta: true
				})
			).toMatchObject({
				type: 'user',
				recordKind: 'tool_result',
				isMeta: true
			});
		});

		it('hides non-image meta records and promptless user records as tool results', () => {
			expect(
				parseSessionRecordValue({
					...createThreadRecordBase(),
					type: 'user',
					message: { content: 'Internal plumbing' },
					isMeta: true,
					promptId: 'prompt-1'
				})
			).toMatchObject({
				type: 'user',
				recordKind: 'tool_result'
			});

			expect(
				parseSessionRecordValue({
					...createThreadRecordBase(),
					type: 'user',
					message: { content: 'System initiated' }
				})
			).toMatchObject({
				type: 'user',
				recordKind: 'tool_result'
			});
		});

		it('treats tool-result-only user content as a tool result record', () => {
			expect(
				parseSessionRecordValue({
					...createThreadRecordBase(),
					type: 'user',
					message: {
						content: [
							{ type: 'tool_result', tool_use_id: 'tool-1', content: 'done', is_error: false }
						]
					},
					promptId: 'prompt-1'
				})
			).toMatchObject({
				type: 'user',
				recordKind: 'tool_result'
			});
		});

		it('parses assistant, progress, system, and metadata records', () => {
			expect(
				parseSessionRecordValue({
					...createThreadRecordBase(),
					type: 'assistant',
					message: {
						content: [{ type: 'text', text: 'Response' }],
						model: 'claude-sonnet-4-6',
						id: 'assistant-msg',
						type: 'message',
						stop_reason: null,
						usage: { input_tokens: 10 }
					},
					requestId: 'request-1',
					isApiErrorMessage: false,
					apiError: { code: 'none' },
					error: 'none',
					extraField: 'ignored'
				})
			).toMatchObject({
				type: 'assistant',
				requestId: 'request-1',
				message: {
					role: 'assistant',
					model: 'claude-sonnet-4-6'
				}
			});

			expect(
				parseSessionRecordValue({
					...createThreadRecordBase(),
					type: 'progress',
					data: { percent: 50 }
				})
			).toMatchObject({
				type: 'progress',
				data: { percent: 50 }
			});

			expect(
				parseSessionRecordValue({
					...createThreadRecordBase(),
					type: 'system',
					subtype: 'compact',
					content: 'Compacting',
					data: { reason: 'size' },
					durationMs: 25,
					logicalParentUuid: 'parent-1',
					compactMetadata: { mode: 'auto' }
				})
			).toMatchObject({
				type: 'system',
				subtype: 'compact',
				durationMs: 25
			});

			expect(
				parseSessionRecordValue({ type: 'summary', summary: 'summary', leafUuid: 'leaf-1' })
			).toEqual({
				type: 'summary',
				summary: 'summary',
				leafUuid: 'leaf-1',
				sessionId: undefined,
				timestamp: undefined,
				cwd: undefined,
				gitBranch: undefined,
				version: undefined
			});

			expect(
				parseSessionRecordValue({
					type: 'custom-title',
					customTitle: 'Pinned title',
					sessionId: 'session-1'
				})
			).toMatchObject({
				type: 'custom-title',
				customTitle: 'Pinned title',
				sessionId: 'session-1'
			});

			expect(
				parseSessionRecordValue({ type: 'last-prompt', lastPrompt: 'continue' })
			).toMatchObject({
				type: 'last-prompt',
				lastPrompt: 'continue'
			});

			expect(parseSessionRecordValue({ type: 'agent-name', agentName: 'Subagent' })).toMatchObject({
				type: 'agent-name',
				agentName: 'Subagent'
			});

			expect(
				parseSessionRecordValue({
					type: 'queue-operation',
					operation: 'push',
					content: { priority: 1 }
				})
			).toMatchObject({
				type: 'queue-operation',
				operation: 'push',
				content: { priority: 1 }
			});

			expect(
				parseSessionRecordValue({
					type: 'file-history-snapshot',
					messageId: 'msg-1',
					isSnapshotUpdate: true,
					snapshot: { file: 'src/app.ts' }
				})
			).toMatchObject({
				type: 'file-history-snapshot',
				messageId: 'msg-1',
				isSnapshotUpdate: true,
				snapshot: { file: 'src/app.ts' }
			});
		});
	});

	describe('normalizeContentBlock', () => {
		it('normalizes supported block types', () => {
			expect(normalizeContentBlock({ type: 'text', text: 'Hello' })).toEqual({
				type: 'text',
				text: 'Hello'
			});
			expect(
				normalizeContentBlock({
					type: 'tool_use',
					id: 'tool-1',
					name: 'Read',
					input: { path: '/home/tester/project/file' },
					caller: 'agent'
				})
			).toEqual({
				type: 'tool_use',
				id: 'tool-1',
				name: 'Read',
				input: { path: '/home/tester/project/file' },
				caller: 'agent'
			});
			expect(
				normalizeContentBlock({
					type: 'tool_result',
					tool_use_id: 'tool-1',
					content: [{ type: 'text', text: 'done' }],
					is_error: true
				})
			).toEqual({
				type: 'tool_result',
				tool_use_id: 'tool-1',
				content: [{ type: 'text', text: 'done' }],
				is_error: true
			});
			expect(
				normalizeContentBlock({
					type: 'tool_result',
					tool_use_id: 'tool-1',
					content: 'text result'
				})
			).toEqual({
				type: 'tool_result',
				tool_use_id: 'tool-1',
				content: 'text result',
				is_error: undefined
			});
			expect(normalizeContentBlock({ type: 'thinking', thinking: 'pondering' })).toEqual({
				type: 'thinking',
				thinking: 'pondering',
				signature: undefined
			});
			expect(
				normalizeContentBlock({
					type: 'image',
					source: { type: 'base64', media_type: 'image/png', data: 'abc123' }
				})
			).toEqual({
				type: 'image',
				source: { type: 'base64', media_type: 'image/png', data: 'abc123' }
			});
		});

		it('returns null for invalid shapes and wraps unknown types', () => {
			expect(normalizeContentBlock(null)).toBeNull();
			expect(normalizeContentBlock({})).toBeNull();
			expect(normalizeContentBlock({ type: 'image', source: 'invalid' })).toBeNull();
			expect(normalizeContentBlock({ type: 'custom', payload: 'value' })).toEqual({
				type: 'unknown',
				originalType: 'custom',
				payload: { type: 'custom', payload: 'value' }
			});
		});
	});
});
