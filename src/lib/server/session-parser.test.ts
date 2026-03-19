import { describe, expect, it, vi } from 'vitest';
import { loadFixture } from '../../../tests/setup.js';
import { parseSessionFile } from './session-parser.js';

describe('server/session-parser', () => {
	it('parses the basic fixture in order and tracks source metadata', async () => {
		const records = await parseSessionFile(loadFixture('basic-project/basic-linear-session.jsonl'));

		expect(
			records.map(({ record, source }) => ({
				type: record.type,
				recordKind: 'recordKind' in record ? record.recordKind : undefined,
				uuid: 'uuid' in record ? record.uuid : undefined,
				recordIndex: source.recordIndex,
				lineNumber: source.lineNumber
			}))
		).toEqual([
			{
				type: 'user',
				recordKind: 'tool_result',
				uuid: 'u1',
				recordIndex: 0,
				lineNumber: 1
			},
			{
				type: 'assistant',
				recordKind: undefined,
				uuid: 'a1',
				recordIndex: 1,
				lineNumber: 2
			},
			{
				type: 'user',
				recordKind: 'tool_result',
				uuid: 'u2',
				recordIndex: 2,
				lineNumber: 3
			}
		]);
	});

	it('preserves metadata records from the metadata fixture', async () => {
		const records = await parseSessionFile(
			loadFixture('metadata-project/native-title-summary-session.jsonl')
		);

		expect(records.map(({ record }) => record.type)).toEqual([
			'user',
			'assistant',
			'custom-title',
			'summary',
			'last-prompt',
			'agent-name'
		]);

		expect(records[2]?.record).toMatchObject({
			type: 'custom-title',
			customTitle: 'Native Titles Win'
		});
		expect(records[3]?.record).toMatchObject({
			type: 'summary',
			summary: 'This session migrated the parser.\nIt kept the UI adapter intact.',
			leafUuid: 'a1'
		});
		expect(records[4]?.record).toMatchObject({
			type: 'last-prompt',
			lastPrompt: 'Refactor the raw schema handling.'
		});
		expect(records[5]?.record).toMatchObject({
			type: 'agent-name',
			agentName: 'claude-inspector'
		});
	});

	it('parses progress and system records without dropping them', async () => {
		const records = await parseSessionFile(
			loadFixture('progress-project/progress-and-system-session.jsonl')
		);

		expect(records.map(({ record }) => record.type)).toEqual([
			'user',
			'progress',
			'system',
			'assistant'
		]);
		expect(records[1]?.record).toMatchObject({
			type: 'progress',
			data: {
				type: 'bash_output_progress',
				output: 'npm run check',
				elapsedTimeSeconds: 4
			}
		});
		expect(records[2]?.record).toMatchObject({
			type: 'system',
			subtype: 'api_error',
			content: 'Rate limited',
			durationMs: 4000
		});
	});

	it('keeps chunked assistant records separate while preserving shared message ids and usage', async () => {
		const records = await parseSessionFile(
			loadFixture('chunked-project/chunked-assistant-usage-session.jsonl')
		);

		expect(records).toHaveLength(3);
		expect(records[1]?.record).toMatchObject({
			type: 'assistant',
			uuid: 'a1',
			message: {
				id: 'msg_chunked_1',
				content: [{ type: 'text', text: 'Working' }]
			}
		});
		expect(records[2]?.record).toMatchObject({
			type: 'assistant',
			uuid: 'a2',
			message: {
				id: 'msg_chunked_1',
				content: [{ type: 'text', text: 'Working on it' }],
				usage: {
					input_tokens: 12,
					output_tokens: 34
				}
			}
		});
	});

	it('preserves file history snapshots', async () => {
		const records = await parseSessionFile(
			loadFixture('file-history-project/file-history-session.jsonl')
		);

		expect(records[2]?.record).toMatchObject({
			type: 'file-history-snapshot',
			messageId: 'a1',
			isSnapshotUpdate: false,
			snapshot: {
				'src/lib/server/messages.ts': {
					history: ['before', 'after']
				}
			}
		});
	});

	it('logs malformed lines and continues parsing valid records', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

		const records = await parseSessionFile(
			loadFixture('corrupt-project/corrupt-line-session.jsonl')
		);

		expect(records).toHaveLength(2);
		expect(
			records.map(({ record, source }) => ({
				type: record.type,
				uuid: 'uuid' in record ? record.uuid : undefined,
				recordIndex: source.recordIndex,
				lineNumber: source.lineNumber
			}))
		).toEqual([
			{ type: 'user', uuid: 'u1', recordIndex: 0, lineNumber: 1 },
			{ type: 'assistant', uuid: 'a1', recordIndex: 1, lineNumber: 3 }
		]);
		expect(warn).toHaveBeenCalledTimes(1);
		expect(warn).toHaveBeenCalledWith(expect.stringContaining('Skipping malformed line 2'));
	});
});
