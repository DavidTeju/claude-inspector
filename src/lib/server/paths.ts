import { homedir } from 'os';
import path from 'path';

/** Resolves the Claude data root directory. Uses CLAUDE_DATA_PATH env var or defaults to ~/.claude */
export function getClaudeDataRoot(): string {
	return process.env.CLAUDE_DATA_PATH || path.join(homedir(), '.claude');
}

/** Returns the path to the projects directory within the Claude data root */
export function getProjectsDir(): string {
	return path.join(getClaudeDataRoot(), 'projects');
}
