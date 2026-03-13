import { readdir, stat } from 'fs/promises';
import path from 'path';
import type { Project } from '../types.js';
import { dirNameToDisplayName } from '../utils.js';
import { listProjectSessionFilesInDir } from './session-discovery.js';
import { getProjectsDir } from './paths.js';
import { getReconciledSessions } from './reconciler.js';

export { dirNameToDisplayName };

/**
 * Scans ~/.claude/projects/ and returns all projects sorted by last modified.
 * Uses the reconciler cache when available, otherwise falls back to file discovery.
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
		const directoryStat = await stat(fullPath).catch(() => null);
		if (!directoryStat?.isDirectory()) continue;

		let sessionCount: number;
		let lastModified = '';

		const reconciled = getReconciledSessions(entry);
		if (reconciled) {
			sessionCount = reconciled.length;
			lastModified = reconciled[0]?.modified || '';
		} else {
			try {
				const descriptors = await listProjectSessionFilesInDir(entry, fullPath);
				sessionCount = descriptors.length;

				if (descriptors.length > 0) {
					const modifiedTimes = await Promise.all(
						descriptors.map(async (descriptor) => {
							const fileStat = await stat(descriptor.fullPath);
							return fileStat.mtime.toISOString();
						})
					);

					lastModified = modifiedTimes.sort().reverse()[0] || '';
				}
			} catch {
				continue;
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
