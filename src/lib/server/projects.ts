import { readdir, stat, readFile } from 'fs/promises';
import path from 'path';
import { getProjectsDir } from './paths.js';
import { getReconciledSessions } from './reconciler.js';
import { dirNameToDisplayName } from '$lib/utils.js';
import type { Project, SessionIndex } from '$lib/types.js';

export { dirNameToDisplayName };

/**
 * Scans ~/.claude/projects/ and returns all projects sorted by last modified.
 * Uses sessions-index.json when available, falls back to counting .jsonl files.
 */
export async function listProjects(): Promise<Project[]> {
	const projectsDir = getProjectsDir();
	let entries: string[];

	try {
		entries = await readdir(projectsDir);
	} catch {
		return [];
	}

	const projects: Project[] = [];

	for (const entry of entries) {
		const fullPath = path.join(projectsDir, entry);
		const s = await stat(fullPath).catch(() => null);
		if (!s || !s.isDirectory()) continue;

		// Use reconciled data if available, otherwise count files
		let sessionCount = 0;
		let lastModified = '';

		const reconciled = getReconciledSessions(entry);
		if (reconciled) {
			sessionCount = reconciled.length;
			if (reconciled.length > 0) {
				lastModified = reconciled[0].modified; // Already sorted newest first
			}
		} else {
			try {
				const files = await readdir(fullPath);
				const jsonlFiles = files.filter((f) => f.endsWith('.jsonl'));
				sessionCount = jsonlFiles.length;

				try {
					const indexPath = path.join(fullPath, 'sessions-index.json');
					const indexData: SessionIndex = JSON.parse(await readFile(indexPath, 'utf-8'));
					if (indexData.entries.length > 0) {
						lastModified = indexData.entries.reduce(
							(max, e) => (e.modified > max ? e.modified : max),
							''
						);
					}
				} catch {
					// No index
				}

				if (!lastModified && jsonlFiles.length > 0) {
					const stats = await Promise.all(
						jsonlFiles.map(async (f) => {
							const fileStat = await stat(path.join(fullPath, f));
							return fileStat.mtime.toISOString();
						})
					);
					lastModified = stats.sort().reverse()[0];
				}
			} catch {
				// Skip this project
			}
		}

		if (sessionCount === 0) continue;

		projects.push({
			id: entry,
			displayName: dirNameToDisplayName(entry),
			path: fullPath,
			sessionCount,
			lastModified
		});
	}

	return projects.sort((a, b) => (b.lastModified || '').localeCompare(a.lastModified || ''));
}
