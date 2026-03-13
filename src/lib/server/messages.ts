import type { ThreadMessage } from '../types.js';
import { toThreadMessages } from './session-adapters.js';
import { parseSessionFile } from './session-parser.js';

/**
 * Parses a session JSONL file into the compatibility transcript model used by the current UI.
 */
export async function parseSessionMessages(
	filePath: string,
	options?: { includeSidechain?: boolean }
): Promise<ThreadMessage[]> {
	const records = await parseSessionFile(filePath);
	return toThreadMessages(records, options);
}
