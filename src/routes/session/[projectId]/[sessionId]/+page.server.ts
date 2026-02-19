import path from 'path';
import { getProjectsDir } from '$lib/server/paths.js';
import { parseSessionMessages } from '$lib/server/messages.js';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types.js';

export const load: PageServerLoad = async ({ params }) => {
	const filePath = path.join(getProjectsDir(), params.projectId, `${params.sessionId}.jsonl`);

	try {
		const messages = await parseSessionMessages(filePath);

		// Serialize ThreadMessages (Maps don't serialize well)
		const serializedMessages = messages.map((m) => ({
			...m,
			toolResults: Object.fromEntries(m.toolResults)
		}));

		return {
			projectId: params.projectId,
			sessionId: params.sessionId,
			messages: serializedMessages
		};
	} catch {
		throw error(404, `Session not found: ${params.sessionId}`);
	}
};
