/**
 * @module
 * Streaming JSONL parser for Claude session transcripts.
 */

import { createReadStream } from 'fs';
import { createInterface } from 'readline';
import { parseSessionRecordValue, type ParsedSessionRecord } from './session-schema.js';

function warnMalformedLine(filePath: string, lineNumber: number): void {
	console.warn(`[session-parser] Skipping malformed line ${lineNumber} in ${filePath}`);
}

/**
 * Stream-parse a session JSONL file into normalized raw records.
 * Malformed lines are skipped so one bad record does not poison the whole session,
 * and `recordIndex` tracks only successfully parsed records for downstream facts/indexing.
 */
export async function parseSessionFile(filePath: string): Promise<ParsedSessionRecord[]> {
	const records: ParsedSessionRecord[] = [];
	const rl = createInterface({
		input: createReadStream(filePath),
		crlfDelay: Infinity
	});

	let recordIndex = 0;
	let lineNumber = 0;

	for await (const line of rl) {
		lineNumber += 1;

		if (!line.trim()) continue;

		try {
			const value = JSON.parse(line);
			const record = parseSessionRecordValue(value);
			if (!record) {
				warnMalformedLine(filePath, lineNumber);
				continue;
			}

			records.push({
				record,
				source: {
					recordIndex,
					lineNumber
				}
			});
			recordIndex += 1;
		} catch {
			warnMalformedLine(filePath, lineNumber);
			continue;
		}
	}

	return records;
}
