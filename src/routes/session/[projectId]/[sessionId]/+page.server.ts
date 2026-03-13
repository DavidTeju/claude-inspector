import { findSessionFile } from '$lib/server/session-discovery.js';
import { parseSessionMessages } from '$lib/server/messages.js';
import { getIndexedSessionMeta } from '$lib/server/session-index-sqlite.js';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types.js';

export const load: PageServerLoad = async ({ params }) => {
	const sessionFile = await findSessionFile(params.projectId, params.sessionId);
	if (!sessionFile) {
		throw error(404, `Session not found: ${params.sessionId}`);
	}

	try {
		const messages = await parseSessionMessages(sessionFile.fullPath, {
			includeSidechain: sessionFile.isSubagent
		});
		const meta = getIndexedSessionMeta(params.projectId, sessionFile.sessionId);

		return {
			projectId: params.projectId,
			sessionId: sessionFile.sessionId,
			routeId: sessionFile.routeId,
			isSubagent: sessionFile.isSubagent,
			parentSessionId: sessionFile.parentSessionId,
			messages,
			summary: meta?.summary ?? null,
			firstPrompt: meta?.firstPrompt ?? null
		};
	} catch {
		throw error(404, `Session not found: ${params.sessionId}`);
	}
};
