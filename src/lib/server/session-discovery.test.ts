import { cpSync, mkdirSync, writeFileSync } from 'node:fs';
import path, { dirname, join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTempDirectory, loadFixture } from '../../../tests/setup.js';
import { findSessionFile, listProjectSessionFilesInDir } from './session-discovery.js';

afterEach(() => {
	vi.unstubAllEnvs();
});

describe('server/session-discovery', () => {
	it('discovers parent and subagent session files from the fixture directory', async () => {
		const projectDir = dirname(loadFixture('subagent-project/parent-session.jsonl'));

		await expect(listProjectSessionFilesInDir('subagent-project', projectDir)).resolves.toEqual([
			{
				projectId: 'subagent-project',
				sessionId: 'parent-session',
				routeId: 'parent-session',
				fullPath: join(projectDir, 'parent-session.jsonl'),
				relativePath: 'parent-session.jsonl',
				isSubagent: false
			},
			{
				projectId: 'subagent-project',
				sessionId: 'agent-child-session',
				routeId: 'parent-session~subagent~agent-child-session',
				fullPath: join(projectDir, 'parent-session/subagents/agent-child-session.jsonl'),
				relativePath: 'parent-session/subagents/agent-child-session.jsonl',
				isSubagent: true,
				parentSessionId: 'parent-session'
			}
		]);
	});

	it('resolves session files by route id, relative path, and unique session id', async () => {
		const claudeDataRoot = createTempDirectory('claude-inspector-data-');
		const projectsDir = path.join(claudeDataRoot, 'projects');
		const sourceProjectDir = dirname(loadFixture('subagent-project/parent-session.jsonl'));
		const projectDir = path.join(projectsDir, 'subagent-project');

		mkdirSync(projectsDir, { recursive: true });
		cpSync(sourceProjectDir, projectDir, { recursive: true });
		vi.stubEnv('CLAUDE_DATA_PATH', claudeDataRoot);

		await expect(
			findSessionFile('subagent-project', 'parent-session~subagent~agent-child-session')
		).resolves.toMatchObject({
			sessionId: 'agent-child-session',
			relativePath: 'parent-session/subagents/agent-child-session.jsonl',
			isSubagent: true,
			parentSessionId: 'parent-session'
		});

		await expect(
			findSessionFile('subagent-project', 'parent-session/subagents/agent-child-session')
		).resolves.toMatchObject({
			routeId: 'parent-session~subagent~agent-child-session'
		});

		await expect(findSessionFile('subagent-project', 'parent-session')).resolves.toMatchObject({
			routeId: 'parent-session',
			isSubagent: false
		});
	});

	it('returns null when a raw session id is ambiguous', async () => {
		const claudeDataRoot = createTempDirectory('claude-inspector-data-');
		const projectDir = path.join(claudeDataRoot, 'projects', 'ambiguous-project');

		mkdirSync(path.join(projectDir, 'parent-a/subagents'), { recursive: true });
		mkdirSync(path.join(projectDir, 'parent-b/subagents'), { recursive: true });
		writeFileSync(
			join(projectDir, 'parent-a/subagents/duplicate.jsonl'),
			'{"type":"summary","sessionId":"duplicate"}\n'
		);
		writeFileSync(
			join(projectDir, 'parent-b/subagents/duplicate.jsonl'),
			'{"type":"summary","sessionId":"duplicate"}\n'
		);
		vi.stubEnv('CLAUDE_DATA_PATH', claudeDataRoot);

		await expect(findSessionFile('ambiguous-project', 'duplicate')).resolves.toBeNull();
	});

	it('returns an empty list for missing project directories', async () => {
		await expect(
			listProjectSessionFilesInDir('missing-project', '/path/that/does/not/exist')
		).resolves.toEqual([]);
	});
});
