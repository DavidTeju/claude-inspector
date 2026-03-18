/**
 * @module
 * File-system discovery for Claude session transcripts, including the nested
 * subagent directory layout and route-safe session ID encoding.
 */

import type { Dirent } from 'fs';
import { readdir } from 'fs/promises';
import path from 'path';

/** Separator used to encode `parent/subagent child` relationships into a single route ID. */
const SUBAGENT_ROUTE_MARKER = '~subagent~';

/** Describes one JSONL session file as both a disk path and an Inspector route target. */
export interface SessionFileDescriptor {
	projectId: string;
	/** Raw JSONL filename without extension. */
	sessionId: string;
	/** Route-safe identifier used in URLs and cache keys (`parent~subagent~child` for subagents). */
	routeId: string;
	fullPath: string;
	relativePath: string;
	isSubagent: boolean;
	parentSessionId?: string;
}

export async function listProjectSessionFiles(projectId: string): Promise<SessionFileDescriptor[]> {
	const { getProjectsDir } = await import('./paths.js');
	return listProjectSessionFilesInDir(projectId, path.join(getProjectsDir(), projectId));
}

/**
 * Lists top-level session files plus one level of `parent/subagents/*.jsonl` children.
 * Other nested directories are ignored because subagent sessions only live under
 * their parent session's dedicated `subagents` directory.
 */
export async function listProjectSessionFilesInDir(
	projectId: string,
	projectDir: string
): Promise<SessionFileDescriptor[]> {
	let entries: Dirent<string>[];

	try {
		entries = await readdir(projectDir, { withFileTypes: true });
	} catch {
		return [];
	}

	const descriptors: SessionFileDescriptor[] = [];

	for (const entry of entries) {
		if (entry.isFile() && entry.name.endsWith('.jsonl')) {
			descriptors.push(
				buildDescriptor(projectId, projectDir, entry.name, {
					isSubagent: false
				})
			);
			continue;
		}

		if (!entry.isDirectory()) continue;

		const parentSessionId = entry.name;
		const subagentsDir = path.join(projectDir, parentSessionId, 'subagents');
		let subagentEntries: Dirent<string>[];

		try {
			subagentEntries = await readdir(subagentsDir, { withFileTypes: true });
		} catch {
			continue;
		}

		for (const subagentEntry of subagentEntries) {
			if (!subagentEntry.isFile() || !subagentEntry.name.endsWith('.jsonl')) continue;

			const relativePath = path.join(parentSessionId, 'subagents', subagentEntry.name);
			descriptors.push(
				buildDescriptor(projectId, projectDir, relativePath, {
					isSubagent: true,
					parentSessionId
				})
			);
		}
	}

	return descriptors.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

/**
 * Resolves a session reference back to a file using the safest match order:
 * route ID first, then relative path, then raw session ID if and only if it is unique.
 */
export async function findSessionFile(
	projectId: string,
	sessionReference: string
): Promise<SessionFileDescriptor | null> {
	const descriptors = await listProjectSessionFiles(projectId);

	const routeMatch = descriptors.find((descriptor) => descriptor.routeId === sessionReference);
	if (routeMatch) return routeMatch;

	const relativePathMatch = descriptors.find(
		(descriptor) => stripJsonlExtension(descriptor.relativePath) === sessionReference
	);
	if (relativePathMatch) return relativePathMatch;

	const sessionIdMatches = descriptors.filter(
		(descriptor) => descriptor.sessionId === sessionReference
	);
	return sessionIdMatches.length === 1 ? sessionIdMatches[0] : null;
}

/**
 * Builds the normalized descriptor for a discovered JSONL file.
 * Subagent children keep their raw filename as `sessionId` but receive a
 * route-safe `parent~subagent~child` ID for URLs and cache keys.
 */
function buildDescriptor(
	projectId: string,
	projectDir: string,
	relativePath: string,
	options: {
		isSubagent: boolean;
		parentSessionId?: string;
	}
): SessionFileDescriptor {
	const sessionId = stripJsonlExtension(path.basename(relativePath));
	const routeId = options.isSubagent
		? `${options.parentSessionId ?? 'subagent'}${SUBAGENT_ROUTE_MARKER}${sessionId}`
		: sessionId;

	return {
		projectId,
		sessionId,
		routeId,
		fullPath: path.join(projectDir, relativePath),
		relativePath,
		isSubagent: options.isSubagent,
		parentSessionId: options.parentSessionId
	};
}

function stripJsonlExtension(fileName: string): string {
	return fileName.endsWith('.jsonl') ? fileName.slice(0, -'.jsonl'.length) : fileName;
}
