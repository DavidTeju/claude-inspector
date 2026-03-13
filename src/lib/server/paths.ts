import { homedir } from 'os';
import path from 'path';

/** Resolves the Claude data root directory. Uses CLAUDE_DATA_PATH env var or defaults to ~/.claude */
export function getClaudeDataRoot(): string {
	return process.env.CLAUDE_DATA_PATH || path.join(homedir(), '.claude');
}

/** Returns the app data directory used for derived local state like config and SQLite indexes. */
export function getInspectorDataDir(): string {
	return path.join(homedir(), '.claude-inspector');
}

/** Returns the path to the projects directory within the Claude data root */
export function getProjectsDir(): string {
	return path.join(getClaudeDataRoot(), 'projects');
}

/** Returns the local SQLite index path for derived project/session metadata. */
export function getSessionIndexDbPath(): string {
	return (
		process.env.CLAUDE_INSPECTOR_DB_PATH || path.join(getInspectorDataDir(), 'session-index.sqlite')
	);
}
