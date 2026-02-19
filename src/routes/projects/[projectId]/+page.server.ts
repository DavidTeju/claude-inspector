import { getSessionsForProject } from '$lib/server/sessions.js';
import type { PageServerLoad } from './$types.js';

export const load: PageServerLoad = async ({ params }) => {
	const sessions = await getSessionsForProject(params.projectId);
	return {
		projectId: params.projectId,
		sessions
	};
};
