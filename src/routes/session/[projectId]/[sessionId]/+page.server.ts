import { error } from '@sveltejs/kit';
import { HTTP_NOT_FOUND } from '$lib/constants.js';
import { normalizeProjectId } from '$lib/server/project-id.js';
import { parseSessionMessages } from '$lib/server/session-adapters.js';
import { findSessionFile } from '$lib/server/session-discovery.js';
import { getIndexedSessionMeta } from '$lib/server/session-index-sqlite.js';
import { getActiveSession } from '$lib/server/session-manager.js';
import type { PageServerLoad } from './$types.js';

interface SessionFileData {
	sessionId: string;
	routeId: string;
	isSubagent: boolean;
	parentSessionId: string | undefined;
	messages: Awaited<ReturnType<typeof parseSessionMessages>>;
	summary: string | null;
	firstPrompt: string | null;
}

async function resolveSessionFile(
	projectId: string,
	sessionId: string
): Promise<SessionFileData | null> {
	const sessionFile = await findSessionFile(projectId, sessionId);
	if (!sessionFile) return null;

	const messages = await parseSessionMessages(sessionFile.fullPath, {
		includeSidechain: sessionFile.isSubagent
	});
	const meta = getIndexedSessionMeta(projectId, sessionFile.sessionId);

	return {
		sessionId: sessionFile.sessionId,
		routeId: sessionFile.routeId,
		isSubagent: sessionFile.isSubagent,
		parentSessionId: sessionFile.parentSessionId ?? undefined,
		messages,
		summary: meta?.summary ?? null,
		firstPrompt: meta?.firstPrompt ?? null
	};
}

function buildDefaults(
	projectId: string,
	sessionId: string
): SessionFileData & { projectId: string } {
	return {
		projectId,
		sessionId,
		routeId: sessionId,
		isSubagent: false,
		parentSessionId: undefined,
		messages: [],
		summary: null,
		firstPrompt: null
	};
}

async function loadSessionData(projectId: string, sessionId: string) {
	const fileData = await resolveSessionFile(projectId, sessionId);
	const activeSession = getActiveSession(sessionId);

	if (!fileData && !activeSession) {
		return null;
	}

	const defaults = buildDefaults(projectId, sessionId);
	const resolved = fileData ? { ...defaults, ...fileData } : defaults;
	return { ...resolved, projectId, isActive: !!activeSession };
}

export const load: PageServerLoad = async ({ params }) => {
	const projectId = normalizeProjectId(params.projectId);
	if (!projectId) throw error(400, 'Invalid project ID');

	try {
		const data = await loadSessionData(projectId, params.sessionId);
		if (!data) {
			throw error(HTTP_NOT_FOUND, `Session not found: ${params.sessionId}`);
		}
		return data;
	} catch (err) {
		if (err && typeof err === 'object' && 'status' in err) throw err;
		throw error(HTTP_NOT_FOUND, `Session not found: ${params.sessionId}`);
	}
};
