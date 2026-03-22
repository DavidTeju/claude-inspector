import { describe, expect, it } from 'vitest';
import { loadFixture } from '../../../tests/setup.js';
import { parseSessionMessages, toSharedContent, toThreadMessages } from './session-adapters.js';
import type { ParsedSessionRecord } from './session-schema.js';

function wrapRecord(record: ParsedSessionRecord['record']): ParsedSessionRecord {
	return {
		record,
		source: {
			recordIndex: 0,
			lineNumber: 1
		}
	};
}

function createBaseRecord(timestamp: string) {
	return {
		sessionId: 'session-1',
		timestamp,
		parentUuid: null as string | null
	};
}

describe('server/session-adapters', () => {
	describe('toThreadMessages', () => {
		it('returns an empty array for empty input', () => {
			expect(toThreadMessages([])).toEqual([]);
		});

		it('converts user-only transcripts', () => {
			const messages = toThreadMessages([
				wrapRecord({
					...createBaseRecord('2025-01-01T00:00:00.000Z'),
					type: 'user',
					recordKind: 'user',
					uuid: 'user-1',
					message: {
						role: 'user',
						content: 'Hello there'
					},
					promptId: 'prompt-1'
				})
			]);

			expect(messages).toEqual([
				{
					uuid: 'user-1',
					role: 'user',
					timestamp: '2025-01-01T00:00:00.000Z',
					textContent: 'Hello there',
					toolCalls: [],
					thinkingBlocks: [],
					rawContent: 'Hello there',
					model: undefined
				}
			]);
		});

		it('converts assistant-only transcripts', () => {
			const messages = toThreadMessages([
				wrapRecord({
					...createBaseRecord('2025-01-01T00:01:00.000Z'),
					type: 'assistant',
					uuid: 'assistant-1',
					message: {
						role: 'assistant',
						content: [
							{ type: 'thinking', thinking: 'considering' },
							{ type: 'text', text: 'Done' }
						],
						model: 'claude-sonnet-4-6'
					}
				})
			]);

			expect(messages).toEqual([
				{
					uuid: 'assistant-1',
					role: 'assistant',
					timestamp: '2025-01-01T00:01:00.000Z',
					textContent: 'Done',
					toolCalls: [],
					thinkingBlocks: ['considering'],
					rawContent: [
						{ type: 'thinking', thinking: 'considering', signature: undefined },
						{ type: 'text', text: 'Done' }
					],
					model: 'claude-sonnet-4-6'
				}
			]);
		});

		it('filters sidechain records unless explicitly included', () => {
			const records: ParsedSessionRecord[] = [
				wrapRecord({
					...createBaseRecord('2025-01-01T00:00:00.000Z'),
					type: 'user',
					recordKind: 'user',
					uuid: 'main-user',
					message: { role: 'user', content: 'Main thread' },
					promptId: 'prompt-1'
				}),
				wrapRecord({
					...createBaseRecord('2025-01-01T00:00:30.000Z'),
					type: 'assistant',
					uuid: 'sidechain-assistant',
					isSidechain: true,
					message: { role: 'assistant', content: 'Hidden sidechain' }
				})
			];

			expect(toThreadMessages(records)).toEqual([expect.objectContaining({ uuid: 'main-user' })]);
			expect(toThreadMessages(records, { includeSidechain: true })).toEqual([
				expect.objectContaining({ uuid: 'main-user' }),
				expect.objectContaining({ uuid: 'sidechain-assistant' })
			]);
		});

		it('orders mixed user and assistant messages and attaches tool results', () => {
			const messages = toThreadMessages([
				wrapRecord({
					...createBaseRecord('2025-01-01T00:00:00.000Z'),
					type: 'user',
					recordKind: 'user',
					uuid: 'user-1',
					message: {
						role: 'user',
						content: [{ type: 'text', text: 'Run the check' }]
					},
					promptId: 'prompt-1'
				}),
				wrapRecord({
					...createBaseRecord('2025-01-01T00:00:05.000Z'),
					type: 'assistant',
					uuid: 'assistant-1',
					parentUuid: 'user-1',
					message: {
						role: 'assistant',
						content: [
							{ type: 'text', text: 'Checking...' },
							{
								type: 'tool_use',
								id: 'tool-1',
								name: 'Read',
								input: { path: '/home/tester/project/file.txt' }
							}
						]
					}
				}),
				wrapRecord({
					...createBaseRecord('2025-01-01T00:00:06.000Z'),
					type: 'user',
					recordKind: 'tool_result',
					uuid: 'tool-result-1',
					parentUuid: 'assistant-1',
					message: {
						role: 'user',
						content: [
							{
								type: 'tool_result',
								tool_use_id: 'tool-1',
								content: [{ type: 'text', text: 'file contents' }],
								is_error: false
							}
						]
					},
					sourceToolUseID: 'tool-1'
				})
			]);

			expect(messages).toEqual([
				{
					uuid: 'user-1',
					role: 'user',
					timestamp: '2025-01-01T00:00:00.000Z',
					textContent: 'Run the check',
					toolCalls: [],
					thinkingBlocks: [],
					rawContent: [{ type: 'text', text: 'Run the check' }],
					model: undefined
				},
				{
					uuid: 'assistant-1',
					role: 'assistant',
					timestamp: '2025-01-01T00:00:05.000Z',
					textContent: 'Checking...',
					toolCalls: [
						{
							id: 'tool-1',
							name: 'Read',
							input: { path: '/home/tester/project/file.txt' },
							result: {
								content: [{ type: 'text', text: 'file contents' }],
								isError: false
							}
						}
					],
					thinkingBlocks: [],
					rawContent: [
						{ type: 'text', text: 'Checking...' },
						{
							type: 'tool_use',
							id: 'tool-1',
							name: 'Read',
							input: { path: '/home/tester/project/file.txt' },
							caller: undefined
						}
					],
					model: undefined
				}
			]);
		});
	});

	describe('toSharedContent', () => {
		it('passes through string content and rejects non-arrays', () => {
			expect(toSharedContent('plain text')).toBe('plain text');
			expect(toSharedContent(null)).toBe('');
			expect(toSharedContent({ type: 'text', text: 'wrong shape' })).toBe('');
		});

		it('normalizes mixed valid and invalid content blocks', () => {
			expect(
				toSharedContent([
					{ type: 'text', text: 'Hello' },
					{
						type: 'tool_use',
						id: 'tool-1',
						name: 'Read',
						input: { path: '/home/tester/project/file' }
					},
					{ type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'abc' } },
					{ type: 'unknown-custom', payload: true },
					null
				])
			).toEqual([
				{ type: 'text', text: 'Hello' },
				{
					type: 'tool_use',
					id: 'tool-1',
					name: 'Read',
					input: { path: '/home/tester/project/file' }
				},
				{
					type: 'image',
					source: { type: 'base64', mediaType: 'image/png', data: 'abc' }
				}
			]);
		});

		it('maps tool_result blocks to the shared camel-cased content union', () => {
			expect(
				toSharedContent([
					{
						type: 'tool_result',
						tool_use_id: 'tool-1',
						content: [{ type: 'text', text: 'Nested result text' }],
						is_error: true
					}
				])
			).toEqual([
				{
					type: 'tool_result',
					toolUseId: 'tool-1',
					content: [{ type: 'text', text: 'Nested result text' }],
					isError: true
				}
			]);
		});

		it('returns an empty array for an empty content array', () => {
			expect(toSharedContent([])).toEqual([]);
		});
	});

	describe('parseSessionMessages', () => {
		it('converts the basic fixture into assistant content with thinking blocks and tool results', async () => {
			const messages = await parseSessionMessages(
				loadFixture('basic-project/basic-linear-session.jsonl')
			);

			expect(messages).toEqual([
				{
					uuid: 'a1',
					role: 'assistant',
					timestamp: '2026-03-01T00:00:01.000Z',
					textContent: "I'll inspect the parser.",
					toolCalls: [
						{
							id: 'tool_basic_1',
							name: 'Read',
							input: { file_path: 'src/lib/server/messages.ts' },
							result: { content: 'file contents', isError: false }
						}
					],
					thinkingBlocks: ['Need to open the parser first.'],
					rawContent: [
						{
							type: 'thinking',
							thinking: 'Need to open the parser first.',
							signature: 'sig-basic'
						},
						{ type: 'text', text: "I'll inspect the parser." },
						{
							type: 'tool_use',
							id: 'tool_basic_1',
							name: 'Read',
							input: { file_path: 'src/lib/server/messages.ts' },
							caller: 'assistant'
						}
					],
					model: 'claude-sonnet-4.5'
				}
			]);
		});

		it('keeps chunked assistant updates in order for downstream UI reassembly', async () => {
			const messages = await parseSessionMessages(
				loadFixture('chunked-project/chunked-assistant-usage-session.jsonl')
			);

			expect(
				messages.map(({ uuid, role, textContent, timestamp }) => ({
					uuid,
					role,
					textContent,
					timestamp
				}))
			).toEqual([
				{
					uuid: 'a1',
					role: 'assistant',
					textContent: 'Working',
					timestamp: '2026-03-05T00:00:01.000Z'
				},
				{
					uuid: 'a2',
					role: 'assistant',
					textContent: 'Working on it',
					timestamp: '2026-03-05T00:00:02.000Z'
				}
			]);
		});
	});
});
