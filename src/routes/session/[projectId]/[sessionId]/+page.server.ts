import { findSessionFile } from '$lib/server/session-discovery.js';
import { parseSessionMessages } from '$lib/server/messages.js';
import { getIndexedSessionMeta } from '$lib/server/session-index-sqlite.js';
import { getActiveSession } from '$lib/server/session-manager.js';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types.js';

export const load: PageServerLoad = async ({ params }) => {
	const sessionFile = await findSessionFile(params.projectId, params.sessionId);
	const activeSession = getActiveSession(params.sessionId);

	if (!sessionFile && !activeSession) {
		throw error(404, `Session not found: ${params.sessionId}`);
	}

	try {
		const messages = sessionFile
			? await parseSessionMessages(sessionFile.fullPath, {
					includeSidechain: sessionFile.isSubagent
				})
			: [];
		const meta = sessionFile
			? getIndexedSessionMeta(params.projectId, sessionFile.sessionId)
			: null;

		return {
			projectId: params.projectId,
			sessionId: sessionFile?.sessionId ?? params.sessionId,
			routeId: sessionFile?.routeId ?? params.sessionId,
			isSubagent: sessionFile?.isSubagent ?? false,
			parentSessionId: sessionFile?.parentSessionId ?? undefined,
			messages,
			summary: meta?.summary ?? null,
			firstPrompt: meta?.firstPrompt ?? null,
			isActive: !!activeSession
		};
	} catch {
		throw error(404, `Session not found: ${params.sessionId}`);
	}
};
