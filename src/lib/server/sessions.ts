import { readdir, readFile, stat } from 'fs/promises';
import { createReadStream } from 'fs';
import { createInterface } from 'readline';
import path from 'path';
import { getProjectsDir } from './paths.js';
import type { SessionEntry, SessionIndex } from '$lib/types.js';

/**
 * Returns all sessions for a project, sorted by modified date (newest first).
 * Reads sessions-index.json if available, otherwise scans JSONL files directly.
 */
export async function getSessionsForProject(projectId: string): Promise<SessionEntry[]> {
	const projectDir = path.join(getProjectsDir(), projectId);

	// Try sessions-index.json first
	try {
		const indexPath = path.join(projectDir, 'sessions-index.json');
		const indexData: SessionIndex = JSON.parse(await readFile(indexPath, 'utf-8'));
		return indexData.entries.sort(
			(a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime()
		);
	} catch {
		// Fallback: scan JSONL files
	}

	return scanJsonlFiles(projectDir);
}

async function scanJsonlFiles(projectDir: string): Promise<SessionEntry[]> {
	let files: string[];
	try {
		files = (await readdir(projectDir)).filter((f) => f.endsWith('.jsonl'));
	} catch {
		return [];
	}

	const entries: SessionEntry[] = [];

	for (const file of files) {
		const fullPath = path.join(projectDir, file);
		const sessionId = file.replace('.jsonl', '');

		try {
			const fileStat = await stat(fullPath);
			const firstLine = await readFirstLine(fullPath);

			if (!firstLine) continue;

			let firstPrompt = '';
			let created = fileStat.birthtime.toISOString();

			// Try to find the first user message for the prompt
			const rl = createInterface({
				input: createReadStream(fullPath),
				crlfDelay: Infinity
			});

			for await (const line of rl) {
				try {
					const record = JSON.parse(line);
					if (record.type === 'user' && record.message?.content) {
						const content = record.message.content;
						if (typeof content === 'string') {
							firstPrompt = content.slice(0, 200);
						} else if (Array.isArray(content)) {
							const textBlock = content.find((b: { type: string }) => b.type === 'text');
							if (textBlock?.text) {
								firstPrompt = textBlock.text.slice(0, 200);
							}
						}
						created = record.timestamp || created;
						break;
					}
				} catch {
					continue;
				}
			}

			entries.push({
				sessionId,
				fullPath,
				fileMtime: fileStat.mtimeMs,
				firstPrompt,
				summary: '',
				messageCount: 0,
				created,
				modified: fileStat.mtime.toISOString(),
				gitBranch: '',
				projectPath: '',
				isSidechain: false
			});
		} catch {
			continue;
		}
	}

	return entries.sort((a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime());
}

async function readFirstLine(filePath: string): Promise<string | null> {
	const rl = createInterface({
		input: createReadStream(filePath),
		crlfDelay: Infinity
	});

	for await (const line of rl) {
		rl.close();
		return line;
	}

	return null;
}
