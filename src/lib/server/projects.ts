import { readdir, stat, readFile } from 'fs/promises';
import path from 'path';
import { getProjectsDir } from './paths.js';
import type { Project, SessionIndex } from '$lib/types.js';

/**
 * Converts a Claude project directory name to a human-readable display name.
 * Strips the path-encoded prefix (e.g. "-Users-david-projects-myapp" -> "myapp")
 */
export function dirNameToDisplayName(dirName: string): string {
	// Strip leading dash, replace dashes with /
	// e.g. "-Users-david-projects-myapp" -> "Users/david/projects/myapp"
	const name = dirName.startsWith('-') ? dirName.slice(1) : dirName;

	// Try to extract just the meaningful project path
	// Pattern: Users/<username>/projects/<name> or Users/<username>/<name>
	const parts = name.split('-');

	// Find "projects" or similar marker to get meaningful name
	const projectsIdx = parts.indexOf('projects');
	if (projectsIdx !== -1 && projectsIdx < parts.length - 1) {
		return parts.slice(projectsIdx + 1).join('-');
	}

	// Otherwise strip "Users-<username>-" prefix
	if (parts[0] === 'Users' && parts.length > 2) {
		return parts.slice(2).join('/');
	}

	return name.replace(/-/g, '/');
}

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

		// Count sessions and get last modified
		let sessionCount = 0;
		let lastModified = '';

		// Try sessions-index.json first
		try {
			const indexPath = path.join(fullPath, 'sessions-index.json');
			const indexData: SessionIndex = JSON.parse(await readFile(indexPath, 'utf-8'));
			sessionCount = indexData.entries.length;
			if (indexData.entries.length > 0) {
				lastModified = indexData.entries
					.map((e) => e.modified)
					.sort()
					.reverse()[0];
			}
		} catch {
			// Fallback: count .jsonl files
			try {
				const files = await readdir(fullPath);
				const jsonlFiles = files.filter((f) => f.endsWith('.jsonl'));
				sessionCount = jsonlFiles.length;
				if (jsonlFiles.length > 0) {
					const stats = await Promise.all(
						jsonlFiles.map(async (f) => {
							const s = await stat(path.join(fullPath, f));
							return s.mtime.toISOString();
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
