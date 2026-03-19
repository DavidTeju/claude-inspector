import { describe, expect, it } from 'vitest';
import { toSharedContent, toThreadMessages } from './session-adapters.js';
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

		it('attaches skill expansion from isMeta record to Skill tool calls', () => {
			const messages = toThreadMessages([
				wrapRecord({
					...createBaseRecord('2025-01-01T00:00:00.000Z'),
					type: 'user',
					recordKind: 'user',
					uuid: 'user-1',
					message: { role: 'user', content: 'Run the commit skill' },
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
							{
								type: 'tool_use',
								id: 'skill-1',
								name: 'Skill',
								input: { skill: 'git-commit-practices' }
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
								tool_use_id: 'skill-1',
								content: 'Launching skill: git-commit-practices'
							}
						]
					},
					sourceToolUseID: 'skill-1'
				}),
				wrapRecord({
					...createBaseRecord('2025-01-01T00:00:07.000Z'),
					type: 'user',
					recordKind: 'tool_result',
					uuid: 'meta-1',
					parentUuid: 'assistant-1',
					isMeta: true,
					message: {
						role: 'user',
						content: 'You are an expert at writing git commits. Follow these practices...'
					}
				})
			]);

			expect(messages).toHaveLength(2);
			const assistantMsg = messages[1];
			expect(assistantMsg.toolCalls).toHaveLength(1);
			expect(assistantMsg.toolCalls[0]).toMatchObject({
				id: 'skill-1',
				name: 'Skill',
				input: { skill: 'git-commit-practices' },
				skillExpansion: 'You are an expert at writing git commits. Follow these practices...',
				result: {
					content: 'Launching skill: git-commit-practices',
					isError: false
				}
			});
		});

		it('does not attach skill expansion to non-Skill tool calls', () => {
			const messages = toThreadMessages([
				wrapRecord({
					...createBaseRecord('2025-01-01T00:00:00.000Z'),
					type: 'assistant',
					uuid: 'assistant-1',
					message: {
						role: 'assistant',
						content: [
							{
								type: 'tool_use',
								id: 'tool-1',
								name: 'Read',
								input: { path: '/home/tester/file.txt' }
							}
						]
					}
				}),
				wrapRecord({
					...createBaseRecord('2025-01-01T00:00:01.000Z'),
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
								content: 'file contents here'
							}
						]
					},
					sourceToolUseID: 'tool-1'
				}),
				wrapRecord({
					...createBaseRecord('2025-01-01T00:00:02.000Z'),
					type: 'user',
					recordKind: 'tool_result',
					uuid: 'meta-1',
					parentUuid: 'assistant-1',
					isMeta: true,
					message: {
						role: 'user',
						content: 'Some internal plumbing text'
					}
				})
			]);

			expect(messages).toHaveLength(1);
			expect(messages[0].toolCalls[0].skillExpansion).toBeUndefined();
		});

		it('handles multiple Skill invocations with correct FIFO matching', () => {
			const messages = toThreadMessages([
				wrapRecord({
					...createBaseRecord('2025-01-01T00:00:00.000Z'),
					type: 'assistant',
					uuid: 'assistant-1',
					message: {
						role: 'assistant',
						content: [
							{
								type: 'tool_use',
								id: 'skill-1',
								name: 'Skill',
								input: { skill: 'commit' }
							}
						]
					}
				}),
				wrapRecord({
					...createBaseRecord('2025-01-01T00:00:01.000Z'),
					type: 'user',
					recordKind: 'tool_result',
					uuid: 'tr-1',
					parentUuid: 'assistant-1',
					message: {
						role: 'user',
						content: [
							{
								type: 'tool_result',
								tool_use_id: 'skill-1',
								content: 'Launching skill: commit'
							}
						]
					},
					sourceToolUseID: 'skill-1'
				}),
				wrapRecord({
					...createBaseRecord('2025-01-01T00:00:02.000Z'),
					type: 'user',
					recordKind: 'tool_result',
					uuid: 'meta-1',
					parentUuid: 'assistant-1',
					isMeta: true,
					message: {
						role: 'user',
						content: 'First skill expansion text'
					}
				}),
				wrapRecord({
					...createBaseRecord('2025-01-01T00:00:10.000Z'),
					type: 'assistant',
					uuid: 'assistant-2',
					message: {
						role: 'assistant',
						content: [
							{
								type: 'tool_use',
								id: 'skill-2',
								name: 'Skill',
								input: { skill: 'simplify' }
							}
						]
					}
				}),
				wrapRecord({
					...createBaseRecord('2025-01-01T00:00:11.000Z'),
					type: 'user',
					recordKind: 'tool_result',
					uuid: 'tr-2',
					parentUuid: 'assistant-2',
					message: {
						role: 'user',
						content: [
							{
								type: 'tool_result',
								tool_use_id: 'skill-2',
								content: 'Launching skill: simplify'
							}
						]
					},
					sourceToolUseID: 'skill-2'
				}),
				wrapRecord({
					...createBaseRecord('2025-01-01T00:00:12.000Z'),
					type: 'user',
					recordKind: 'tool_result',
					uuid: 'meta-2',
					parentUuid: 'assistant-2',
					isMeta: true,
					message: {
						role: 'user',
						content: 'Second skill expansion text'
					}
				})
			]);

			expect(messages).toHaveLength(2);
			expect(messages[0].toolCalls[0]).toMatchObject({
				id: 'skill-1',
				name: 'Skill',
				skillExpansion: 'First skill expansion text'
			});
			expect(messages[1].toolCalls[0]).toMatchObject({
				id: 'skill-2',
				name: 'Skill',
				skillExpansion: 'Second skill expansion text'
			});
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

		it('returns an empty array for an empty content array', () => {
			expect(toSharedContent([])).toEqual([]);
		});
	});
});
