import { error } from '@sveltejs/kit';
import { normalizeProjectId } from '$lib/server/project-id.js';
import { getSessionsForProject } from '$lib/server/sessions.js';
import type { PageServerLoad } from './$types.js';

export const load: PageServerLoad = async ({ params }) => {
	const projectId = normalizeProjectId(params.projectId);
	if (!projectId) throw error(400, 'Invalid project ID');

	const sessions = await getSessionsForProject(projectId);
	return {
		projectId,
		sessions
	};
};
