/**
 * @module
 * Validation helpers for project identifiers that appear in routes and file-system lookups.
 */

import path from 'node:path';

/**
 * Normalizes a project ID while rejecting path traversal and path separator input.
 * Project IDs must stay as single directory names under the Claude storage root.
 */
export function normalizeProjectId(projectId: string): string | null {
	const normalized = projectId.trim();
	if (!normalized) return null;

	if (normalized.includes(path.sep) || normalized.includes(path.posix.sep)) {
		return null;
	}

	// Reject path-traversal segments (`..` bounded by `-` separators, or at start/end).
	// Literal `..` within a name segment (e.g. `bar..baz`) is harmless and allowed.
	const segments = normalized.split('-');
	if (segments.some((s) => s === '..')) {
		return null;
	}

	return normalized;
}
