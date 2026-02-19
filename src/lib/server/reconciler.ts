import { readdir, readFile, writeFile, stat } from 'fs/promises';
import { createReadStream } from 'fs';
import { createInterface } from 'readline';
import path from 'path';
import { getProjectsDir } from './paths.js';
import { getConfig } from './config.js';
import type { SessionEntry, SessionIndex } from '$lib/types.js';

/** In-memory cache of reconciled sessions per project */
const cache = new Map<string, SessionEntry[]>();
const reconciledProjects = new Set<string>();
let reconciling = false;

/** Returns cached reconciled sessions, or null if not yet reconciled */
export function getReconciledSessions(projectId: string): SessionEntry[] | null {
	return cache.get(projectId) ?? null;
}

/** Whether a project has been reconciled */
export function isReconciled(projectId: string): boolean {
	return reconciledProjects.has(projectId);
}

/** Fire-and-forget: reconcile all projects in background */
export function startReconciliation(): void {
	if (reconciling) return;
	reconciling = true;

	reconcileAllProjects()
		.catch((err) => console.error('[reconciler] failed:', err))
		.finally(() => {
			reconciling = false;
		});
}

async function reconcileAllProjects(): Promise<void> {
	const projectsDir = getProjectsDir();
	let dirs: string[];

	try {
		dirs = await readdir(projectsDir);
	} catch {
		return;
	}

	for (const dir of dirs) {
		const fullDir = path.join(projectsDir, dir);
		const dirStat = await stat(fullDir).catch(() => null);
		if (!dirStat?.isDirectory()) continue;

		try {
			await reconcileProject(dir, fullDir);
		} catch (err) {
			console.error(`[reconciler] error reconciling ${dir}:`, err);
		}
	}

	// After all projects reconciled, generate missing summaries
	const config = await getConfig();
	if (config.anthropicApiKey) {
		for (const [projectId, entries] of cache) {
			const missing = entries.filter((e) => !e.summary);
			if (missing.length > 0) {
				await generateSummaries(projectId, missing, config.anthropicApiKey);
			}
		}
	}
}

async function reconcileProject(projectId: string, projectDir: string): Promise<void> {
	// 1. Get all JSONL files on disk
	const allFiles = await readdir(projectDir);
	const jsonlFiles = allFiles.filter((f) => f.endsWith('.jsonl'));

	if (jsonlFiles.length === 0) return;

	// 2. Load existing index
	const indexMap = new Map<string, SessionEntry>();
	try {
		const indexPath = path.join(projectDir, 'sessions-index.json');
		const indexData: SessionIndex = JSON.parse(await readFile(indexPath, 'utf-8'));
		for (const entry of indexData.entries) {
			indexMap.set(entry.sessionId, entry);
		}
	} catch {
		// No index or corrupt — we'll rebuild from scratch
	}

	// 3. Reconcile each JSONL file
	const entries: SessionEntry[] = [];

	for (const file of jsonlFiles) {
		const sessionId = file.replace('.jsonl', '');
		const fullPath = path.join(projectDir, file);

		try {
			const fileStat = await stat(fullPath);
			const existingEntry = indexMap.get(sessionId);

			// If index entry exists and mtime matches, reuse it
			if (existingEntry && Math.abs(fileStat.mtimeMs - existingEntry.fileMtime) < 1000) {
				entries.push(existingEntry);
				continue;
			}

			// Otherwise, scan the JSONL file
			const scanned = await scanJsonlForMetadata(fullPath, fileStat);
			if (!scanned) continue; // Empty session — skip

			// Preserve summary from existing index entry
			if (existingEntry?.summary) {
				scanned.summary = existingEntry.summary;
			}

			scanned.sessionId = sessionId;
			scanned.fullPath = fullPath;
			entries.push(scanned);
		} catch {
			continue;
		}
	}

	// Sort by modified, newest first
	entries.sort((a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime());

	// 4. Write back to sessions-index.json
	const indexData: SessionIndex = { version: 1, entries };
	const indexPath = path.join(projectDir, 'sessions-index.json');
	try {
		await writeFile(indexPath, JSON.stringify(indexData, null, '\t'), 'utf-8');
	} catch (err) {
		console.error(`[reconciler] failed to write index for ${projectId}:`, err);
	}

	// 5. Store in cache
	cache.set(projectId, entries);
	reconciledProjects.add(projectId);
}

/**
 * Stream-parses a JSONL file to extract session metadata.
 * Returns null if the session has no user messages (empty session).
 */
async function scanJsonlForMetadata(
	filePath: string,
	fileStat: { mtimeMs: number; mtime: Date; birthtime: Date }
): Promise<SessionEntry | null> {
	const rl = createInterface({
		input: createReadStream(filePath),
		crlfDelay: Infinity
	});

	let firstPrompt = '';
	let messageCount = 0;
	let created = '';
	let modified = '';
	let gitBranch = '';
	let hasUserMessage = false;

	for await (const line of rl) {
		try {
			const record = JSON.parse(line);

			if (!created && record.timestamp) {
				created = record.timestamp;
			}
			if (record.timestamp) {
				modified = record.timestamp;
			}
			if (!gitBranch && record.gitBranch) {
				gitBranch = record.gitBranch;
			}

			if (record.type === 'user' || record.type === 'assistant') {
				messageCount++;
			}

			// Extract first user prompt
			if (record.type === 'user' && !firstPrompt && record.message?.content) {
				const content = record.message.content;
				if (typeof content === 'string') {
					const trimmed = content.trim();
					if (trimmed) {
						firstPrompt = trimmed.slice(0, 200);
						hasUserMessage = true;
					}
				} else if (Array.isArray(content)) {
					const textBlock = content.find(
						(b: { type: string; text?: string }) => b.type === 'text' && b.text?.trim()
					);
					if (textBlock?.text) {
						firstPrompt = textBlock.text.trim().slice(0, 200);
						hasUserMessage = true;
					}
				}
			}

			// Check for any user message with text (even if not the first)
			if (!hasUserMessage && record.type === 'user' && record.message?.content) {
				const content = record.message.content;
				if (typeof content === 'string' && content.trim()) {
					hasUserMessage = true;
				} else if (Array.isArray(content)) {
					const hasText = content.some(
						(b: { type: string; text?: string }) => b.type === 'text' && b.text?.trim()
					);
					if (hasText) hasUserMessage = true;
				}
			}
		} catch {
			continue;
		}
	}

	// Filter: skip sessions with no user messages
	if (!hasUserMessage) return null;

	return {
		sessionId: '',
		fullPath: '',
		fileMtime: fileStat.mtimeMs,
		firstPrompt,
		summary: '',
		messageCount,
		created: created || fileStat.birthtime.toISOString(),
		modified: modified || fileStat.mtime.toISOString(),
		gitBranch,
		projectPath: '',
		isSidechain: false
	};
}

/** Generate summaries for sessions that don't have one, using Haiku */
async function generateSummaries(
	projectId: string,
	entries: SessionEntry[],
	apiKey: string
): Promise<void> {
	// Dynamic import to avoid bundling issues when no key is set
	const { default: Anthropic } = await import('@anthropic-ai/sdk');
	const client = new Anthropic({ apiKey });

	for (const entry of entries) {
		if (entry.summary) continue;

		try {
			const prompt = entry.firstPrompt || '(no prompt)';
			const response = await client.messages.create({
				model: 'claude-haiku-4-5-20251001',
				max_tokens: 30,
				messages: [
					{
						role: 'user',
						content: `Summarize this Claude Code session in 6-10 words as a short title. The first user message was: "${prompt.slice(0, 500)}"\n\nRespond with ONLY the title, no quotes or punctuation.`
					}
				]
			});

			const text = response.content[0];
			if (text.type === 'text' && text.text) {
				entry.summary = text.text.trim();
			}
		} catch (err) {
			console.error(`[reconciler] summary generation failed for ${entry.sessionId}:`, err);
			break; // Stop on first error (likely rate limit or bad key)
		}
	}

	// Write updated summaries back to index
	const entries_all = cache.get(projectId);
	if (entries_all) {
		const projectDir = path.join(getProjectsDir(), projectId);
		const indexPath = path.join(projectDir, 'sessions-index.json');
		const indexData: SessionIndex = { version: 1, entries: entries_all };
		try {
			await writeFile(indexPath, JSON.stringify(indexData, null, '\t'), 'utf-8');
		} catch {
			// Silent fail — cache is still updated
		}
	}
}
