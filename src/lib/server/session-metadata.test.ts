import { describe, expect, it } from 'vitest';
import type { ParsedSessionRecord } from './session-schema.js';
import type { SessionFileDescriptor } from './session-discovery.js';
import { extractSessionEntry } from './session-metadata.js';

function wrapRecord(record: ParsedSessionRecord['record']): ParsedSessionRecord {
	return {
		record,
		source: {
			recordIndex: 0,
			lineNumber: 1
		}
	};
}

function createDescriptor(overrides: Partial<SessionFileDescriptor> = {}): SessionFileDescriptor {
	return {
		projectId: 'project-1',
		sessionId: 'session-1',
		routeId: 'session-1',
		fullPath: '/tmp/project-1/session-1.jsonl',
		relativePath: 'session-1.jsonl',
		isSubagent: false,
		...overrides
	};
}

function createFileStat() {
	return {
		mtimeMs: 1_735_689_600_000,
		mtime: new Date('2025-01-02T00:00:00.000Z'),
		birthtime: new Date('2025-01-01T00:00:00.000Z')
	};
}

describe('server/session-metadata', () => {
	it('returns null when records contain no meaningful session content', () => {
		expect(extractSessionEntry(createDescriptor(), [], createFileStat())).toBeNull();
	});

	it('prefers custom titles over native summaries and uses record timestamps', () => {
		const entry = extractSessionEntry(
			createDescriptor(),
			[
				wrapRecord({
					type: 'custom-title',
					customTitle: 'Pinned title',
					timestamp: '2025-01-01T00:00:00.000Z'
				}),
				wrapRecord({
					type: 'summary',
					summary: ' Native summary line 1\nline 2',
					timestamp: '2025-01-01T00:01:00.000Z'
				}),
				wrapRecord({
					type: 'user',
					recordKind: 'user',
					uuid: 'user-1',
					parentUuid: null,
					sessionId: 'session-1',
					timestamp: '2025-01-01T00:02:00.000Z',
					gitBranch: 'main',
					message: { role: 'user', content: 'First prompt' },
					promptId: 'prompt-1'
				}),
				wrapRecord({
					type: 'assistant',
					uuid: 'assistant-1',
					parentUuid: 'user-1',
					sessionId: 'session-1',
					timestamp: '2025-01-01T00:03:00.000Z',
					message: { role: 'assistant', content: 'Response', id: 'assistant-1' }
				}),
				wrapRecord({
					type: 'last-prompt',
					lastPrompt: 'Latest prompt',
					timestamp: '2025-01-01T00:04:00.000Z'
				})
			],
			createFileStat()
		);

		expect(entry).toEqual({
			sessionId: 'session-1',
			displaySessionId: 'session-1',
			fullPath: '/tmp/project-1/session-1.jsonl',
			relativePath: 'session-1.jsonl',
			fileMtime: 1_735_689_600_000,
			firstPrompt: 'First prompt',
			summary: 'Pinned title',
			messageCount: 2,
			created: '2025-01-01T00:00:00.000Z',
			modified: '2025-01-01T00:04:00.000Z',
			gitBranch: 'main',
			projectPath: 'session-1.jsonl',
			isSidechain: false,
			isSubagent: false,
			parentSessionId: undefined,
			customTitle: 'Pinned title',
			nativeSummary: 'Native summary line 1\nline 2',
			lastPrompt: 'Latest prompt'
		});
	});

	it('falls back to file stats, summarized native summaries, and last prompt when needed', () => {
		const entry = extractSessionEntry(
			createDescriptor(),
			[
				wrapRecord({
					type: 'summary',
					summary: '\n  Native summary first line  \nSecond line'
				}),
				wrapRecord({
					type: 'last-prompt',
					lastPrompt: 'Recovered prompt'
				})
			],
			createFileStat()
		);

		expect(entry).toEqual({
			sessionId: 'session-1',
			displaySessionId: 'session-1',
			fullPath: '/tmp/project-1/session-1.jsonl',
			relativePath: 'session-1.jsonl',
			fileMtime: 1_735_689_600_000,
			firstPrompt: 'Recovered prompt',
			summary: 'Native summary first line',
			messageCount: 0,
			created: '2025-01-01T00:00:00.000Z',
			modified: '2025-01-02T00:00:00.000Z',
			gitBranch: '',
			projectPath: 'session-1.jsonl',
			isSidechain: false,
			isSubagent: false,
			parentSessionId: undefined,
			nativeSummary: 'Native summary first line  \nSecond line',
			customTitle: undefined,
			lastPrompt: 'Recovered prompt'
		});
	});

	it('deduplicates assistant records that share the same message id', () => {
		const entry = extractSessionEntry(
			createDescriptor(),
			[
				wrapRecord({
					type: 'assistant',
					uuid: 'assistant-1',
					parentUuid: null,
					sessionId: 'session-1',
					timestamp: '2025-01-01T00:03:00.000Z',
					message: { role: 'assistant', content: 'First response', id: 'assistant-shared' }
				}),
				wrapRecord({
					type: 'assistant',
					uuid: 'assistant-2',
					parentUuid: 'assistant-1',
					sessionId: 'session-1',
					timestamp: '2025-01-01T00:04:00.000Z',
					message: { role: 'assistant', content: 'Duplicate assistant', id: 'assistant-shared' }
				})
			],
			createFileStat()
		);

		expect(entry).toMatchObject({
			messageCount: 1,
			created: '2025-01-01T00:03:00.000Z',
			modified: '2025-01-01T00:04:00.000Z'
		});
	});

	it('preserves subagent metadata in the returned entry', () => {
		const entry = extractSessionEntry(
			createDescriptor({
				sessionId: 'child-session',
				routeId: 'parent~subagent~child-session',
				relativePath: 'parent/subagents/child-session.jsonl',
				fullPath: '/tmp/project-1/parent/subagents/child-session.jsonl',
				isSubagent: true,
				parentSessionId: 'parent'
			}),
			[
				wrapRecord({
					type: 'user',
					recordKind: 'user',
					uuid: 'user-1',
					parentUuid: null,
					sessionId: 'child-session',
					timestamp: '2025-01-01T00:02:00.000Z',
					message: { role: 'user', content: 'Subagent prompt' },
					promptId: 'prompt-1'
				})
			],
			createFileStat()
		);

		expect(entry).toMatchObject({
			sessionId: 'parent~subagent~child-session',
			displaySessionId: 'child-session',
			projectPath: 'parent/subagents/child-session.jsonl',
			isSubagent: true,
			parentSessionId: 'parent',
			firstPrompt: 'Subagent prompt'
		});
	});
});
