import { readdir, readFile, stat, writeFile } from 'fs/promises';
import path from 'path';
import { SESSION_INDEX_VERSION, type SessionEntry, type SessionIndex } from '../types.js';
import { getConfig } from './config.js';
import { listProjectSessionFilesInDir, type SessionFileDescriptor } from './session-discovery.js';
import { extractSessionEntry } from './session-metadata.js';
import { getProjectsDir } from './paths.js';
import { parseSessionFile } from './session-parser.js';

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

export async function reconcileProjectNow(projectId: string): Promise<SessionEntry[]> {
	const projectDir = path.join(getProjectsDir(), projectId);
	const dirStat = await stat(projectDir).catch(() => null);
	if (!dirStat?.isDirectory()) return [];

	return reconcileProject(projectId, projectDir);
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

	const config = await getConfig();
	if (config.anthropicApiKey) {
		for (const [projectId, entries] of cache) {
			const missing = entries.filter((entry) => !entry.summary);
			if (missing.length > 0) {
				await generateSummaries(projectId, missing, config.anthropicApiKey);
			}
		}
	}
}

async function reconcileProject(projectId: string, projectDir: string): Promise<SessionEntry[]> {
	const descriptors = await listProjectSessionFilesInDir(projectId, projectDir);
	if (descriptors.length === 0) {
		cache.set(projectId, []);
		reconciledProjects.add(projectId);
		return [];
	}

	const indexMap = await loadSessionIndex(projectDir);
	const entries: SessionEntry[] = [];

	for (const descriptor of descriptors) {
		try {
			const fileStat = await stat(descriptor.fullPath);
			const existingEntry = indexMap.get(descriptor.routeId);

			if (existingEntry && Math.abs(fileStat.mtimeMs - existingEntry.fileMtime) < 1000) {
				entries.push(patchIndexedEntry(existingEntry, descriptor, fileStat.mtimeMs));
				continue;
			}

			const records = await parseSessionFile(descriptor.fullPath);
			const scanned = extractSessionEntry(descriptor, records, fileStat);
			if (!scanned) continue;

			if (!scanned.summary && existingEntry?.summary) {
				scanned.summary = existingEntry.summary;
			}

			entries.push(scanned);
		} catch {
			continue;
		}
	}

	entries.sort((a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime());

	const indexData: SessionIndex = { version: SESSION_INDEX_VERSION, entries };
	const indexPath = path.join(projectDir, 'sessions-index.json');
	try {
		await writeFile(indexPath, JSON.stringify(indexData, null, '\t'), 'utf-8');
	} catch (err) {
		console.error(`[reconciler] failed to write index for ${projectId}:`, err);
	}

	cache.set(projectId, entries);
	reconciledProjects.add(projectId);
	return entries;
}

async function loadSessionIndex(projectDir: string): Promise<Map<string, SessionEntry>> {
	const indexPath = path.join(projectDir, 'sessions-index.json');

	try {
		const indexData: SessionIndex = JSON.parse(await readFile(indexPath, 'utf-8'));
		if (indexData.version !== SESSION_INDEX_VERSION) {
			return new Map();
		}

		return new Map(indexData.entries.map((entry) => [entry.sessionId, entry]));
	} catch {
		return new Map();
	}
}

function patchIndexedEntry(
	entry: SessionEntry,
	descriptor: SessionFileDescriptor,
	fileMtime: number
): SessionEntry {
	return {
		...entry,
		sessionId: descriptor.routeId,
		displaySessionId: descriptor.sessionId,
		fullPath: descriptor.fullPath,
		relativePath: descriptor.relativePath,
		fileMtime,
		projectPath: descriptor.relativePath,
		isSubagent: descriptor.isSubagent,
		parentSessionId: descriptor.parentSessionId
	};
}

/** Generate summaries for sessions that don't have one, using Haiku */
async function generateSummaries(
	projectId: string,
	entries: SessionEntry[],
	apiKey: string
): Promise<void> {
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
			break;
		}
	}

	const entriesAll = cache.get(projectId);
	if (!entriesAll) return;

	const projectDir = path.join(getProjectsDir(), projectId);
	const indexPath = path.join(projectDir, 'sessions-index.json');
	const indexData: SessionIndex = { version: SESSION_INDEX_VERSION, entries: entriesAll };

	try {
		await writeFile(indexPath, JSON.stringify(indexData, null, '\t'), 'utf-8');
	} catch {
		// Cache is still updated in-memory.
	}
}
