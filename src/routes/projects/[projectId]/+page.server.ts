import { error } from '@sveltejs/kit';
import { HTTP_BAD_REQUEST } from '$lib/constants.js';
import { normalizeProjectId } from '$lib/server/project-id.js';
import { getSessionsForProject } from '$lib/server/sessions.js';
import type { PageServerLoad } from './$types.js';

export const load: PageServerLoad = async ({ params }) => {
	const projectId = normalizeProjectId(params.projectId);
	if (!projectId) throw error(HTTP_BAD_REQUEST, 'Invalid project ID');

	const sessions = await getSessionsForProject(projectId);
	return {
		projectId,
		sessions
	};
};
