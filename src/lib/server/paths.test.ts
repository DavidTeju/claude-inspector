import { homedir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	getClaudeDataRoot,
	getInspectorDataDir,
	getProjectsDir,
	getSessionIndexDbPath
} from './paths.js';

afterEach(() => {
	vi.unstubAllEnvs();
});

describe('server/paths', () => {
	it('uses homedir defaults when environment overrides are absent', () => {
		delete process.env.CLAUDE_DATA_PATH;
		delete process.env.CLAUDE_INSPECTOR_DB_PATH;

		expect(getClaudeDataRoot()).toBe(path.join(homedir(), '.claude'));
		expect(getInspectorDataDir()).toBe(path.join(homedir(), '.claude-inspector'));
		expect(getProjectsDir()).toBe(path.join(homedir(), '.claude', 'projects'));
		expect(getSessionIndexDbPath()).toBe(
			path.join(homedir(), '.claude-inspector', 'session-index.sqlite')
		);
	});

	it('honors environment overrides for Claude data and SQLite paths', () => {
		vi.stubEnv('CLAUDE_DATA_PATH', '/tmp/claude-data');
		vi.stubEnv('CLAUDE_INSPECTOR_DB_PATH', '/tmp/claude-inspector.sqlite');

		expect(getClaudeDataRoot()).toBe('/tmp/claude-data');
		expect(getProjectsDir()).toBe(path.join('/tmp/claude-data', 'projects'));
		expect(getSessionIndexDbPath()).toBe('/tmp/claude-inspector.sqlite');
	});
});
