import path from 'node:path';

export function normalizeProjectId(projectId: string): string | null {
	const normalized = projectId.trim();
	if (!normalized) return null;

	if (
		normalized.includes(path.sep) ||
		normalized.includes(path.posix.sep) ||
		normalized.includes('..')
	) {
		return null;
	}

	return normalized;
}
