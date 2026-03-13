import path from 'path';
import { getProjectsDir } from '$lib/server/paths.js';
import { parseSessionMessages } from '$lib/server/messages.js';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types.js';

export const load: PageServerLoad = async ({ params }) => {
	const filePath = path.join(getProjectsDir(), params.projectId, `${params.sessionId}.jsonl`);

	try {
		const messages = await parseSessionMessages(filePath);

		return {
			projectId: params.projectId,
			sessionId: params.sessionId,
			messages
		};
	} catch {
		throw error(404, `Session not found: ${params.sessionId}`);
	}
};
