import type { Dirent } from 'fs';
import { readdir } from 'fs/promises';
import path from 'path';

const SUBAGENT_ROUTE_MARKER = '~subagent~';

export interface SessionFileDescriptor {
	projectId: string;
	/** Raw JSONL filename without extension. */
	sessionId: string;
	/** Route-safe identifier used in URLs and cache keys. */
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
