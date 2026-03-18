/**
 * @module
 * Incremental reconciliation between Claude's JSONL session files, the legacy
 * `sessions-index.json`, and the SQLite-backed search index.
 */

import { readdir, stat, writeFile } from 'fs/promises';
import path from 'path';
import { SUMMARY_PROMPT_SLICE_LENGTH } from '../constants.js';
import { SESSION_INDEX_VERSION, type SessionEntry, type SessionIndex } from '../types.js';
import { getConfig } from './config.js';
import { getProjectsDir } from './paths.js';
import { listProjectSessionFilesInDir } from './session-discovery.js';
import {
	buildIndexedSessionData,
	deleteIndexedProjects,
	getIndexedProjectIds,
	getIndexedSessions,
	getIndexedSessionsByPath,
	getReconcileStateByPath,
	persistProjectIndex,
	updateIndexedSessionSummary,
	type IndexedSessionData
} from './session-index-sqlite.js';
import { parseSessionFile } from './session-parser.js';

/** In-memory cache of reconciled sessions per project */
const cache = new Map<string, SessionEntry[]>();
const reconciledProjects = new Set<string>();
let reconciling = false;

/** Returns cached reconciled sessions, or null if not yet reconciled */
export function getReconciledSessions(projectId: string): SessionEntry[] | null {
	const cached = cache.get(projectId);
	if (cached) return cached;

	const indexed = getIndexedSessions(projectId);
	if (indexed.length > 0) {
		cache.set(projectId, indexed);
		reconciledProjects.add(projectId);
		return indexed;
	}

	return null;
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
	if (!dirStat?.isDirectory()) {
		deleteIndexedProjects([projectId]);
		cache.delete(projectId);
		reconciledProjects.delete(projectId);
		return [];
	}

	return reconcileProject(projectId, projectDir);
}

/**
 * Reconciles every discovered project, then removes stale indexed projects, then
 * optionally backfills missing summaries. That ordering keeps the caches and DB
 * aligned before any summary generation runs.
 */
async function reconcileAllProjects(): Promise<void> {
	const projectsDir = getProjectsDir();
	let dirs: string[];

	try {
		dirs = await readdir(projectsDir);
	} catch {
		return;
	}

	const projectIdsOnDisk: string[] = [];

	for (const dir of dirs) {
		const fullDir = path.join(projectsDir, dir);
		const dirStat = await stat(fullDir).catch(() => null);
		if (!dirStat?.isDirectory()) continue;
		projectIdsOnDisk.push(dir);

		try {
			await reconcileProject(dir, fullDir);
		} catch (err) {
			console.error(`[reconciler] error reconciling ${dir}:`, err);
		}
	}

	const staleProjectIds = getIndexedProjectIds().filter(
		(projectId) => !projectIdsOnDisk.includes(projectId)
	);
	if (staleProjectIds.length > 0) {
		deleteIndexedProjects(staleProjectIds);
		for (const projectId of staleProjectIds) {
			cache.delete(projectId);
			reconciledProjects.delete(projectId);
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

/**
 * Reconciles one project's session files incrementally using mtime/size checks.
 * Existing summaries are preserved when a session is re-indexed without a new
 * summary so user-visible titles are not lost during refreshes.
 */
async function reconcileProject(projectId: string, projectDir: string): Promise<SessionEntry[]> {
	const descriptors = await listProjectSessionFilesInDir(projectId, projectDir);
	const indexedSessionsByPath = getIndexedSessionsByPath(projectId);
	const reconcileStateByPath = getReconcileStateByPath(projectId);
	const entries: SessionEntry[] = [];
	const changedSessions: IndexedSessionData[] = [];
	const retainedPaths = new Set<string>();

	for (const descriptor of descriptors) {
		try {
			const fileStat = await stat(descriptor.fullPath);
			const existingSession = indexedSessionsByPath.get(descriptor.fullPath);
			const reconcileState = reconcileStateByPath.get(descriptor.fullPath);

			if (
				existingSession &&
				reconcileState &&
				reconcileState.mtime_ms === fileStat.mtimeMs &&
				reconcileState.size_bytes === fileStat.size
			) {
				entries.push(existingSession.entry);
				retainedPaths.add(descriptor.fullPath);
				continue;
			}

			const records = await parseSessionFile(descriptor.fullPath);
			const indexedSession = buildIndexedSessionData(descriptor, records, fileStat);
			if (!indexedSession) continue;

			if (!indexedSession.entry.summary && existingSession?.entry.summary) {
				indexedSession.entry.summary = existingSession.entry.summary;
			}

			entries.push(indexedSession.entry);
			changedSessions.push(indexedSession);
			retainedPaths.add(descriptor.fullPath);
		} catch {
			continue;
		}
	}

	entries.sort((a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime());
	const removedPaths = [...indexedSessionsByPath.keys()].filter(
		(fullPath) => !retainedPaths.has(fullPath)
	);
	const removedSessionIds = removedPaths
		.map((fullPath) => indexedSessionsByPath.get(fullPath)?.entry.sessionId)
		.filter((sessionId): sessionId is string => Boolean(sessionId));
	persistProjectIndex(projectId, projectDir, changedSessions, removedSessionIds, entries);
	await writeSessionIndex(projectId, projectDir, entries);

	if (entries.length > 0) {
		cache.set(projectId, entries);
	} else {
		cache.delete(projectId);
	}
	reconciledProjects.add(projectId);
	return entries;
}

async function writeSessionIndex(
	projectId: string,
	projectDir: string,
	entries: SessionEntry[]
): Promise<void> {
	const indexData: SessionIndex = { version: SESSION_INDEX_VERSION, entries };
	const indexPath = path.join(projectDir, 'sessions-index.json');

	try {
		await writeFile(indexPath, JSON.stringify(indexData, null, '\t'), 'utf-8');
	} catch (err) {
		console.error(`[reconciler] failed to write index for ${projectId}:`, err);
	}
}

/**
 * Generates fallback summaries for sessions that still lack one after indexing.
 * The loop stops after the first failure because a bad API key or account-wide
 * Anthropic issue would make subsequent calls fail the same way.
 */
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
						content: `Summarize this Claude Code session in 6-10 words as a short title. The first user message was: "${prompt.slice(0, SUMMARY_PROMPT_SLICE_LENGTH)}"\n\nRespond with ONLY the title, no quotes or punctuation.`
					}
				]
			});

			const text = response.content[0];
			if (text.type === 'text' && text.text) {
				entry.summary = text.text.trim();
				updateIndexedSessionSummary(projectId, entry.sessionId, entry.summary);
			}
		} catch (err) {
			console.error(`[reconciler] summary generation failed for ${entry.sessionId}:`, err);
			break;
		}
	}

	const entriesAll = cache.get(projectId);
	if (!entriesAll) return;

	const projectDir = path.join(getProjectsDir(), projectId);
	await writeSessionIndex(projectId, projectDir, entriesAll);
}
