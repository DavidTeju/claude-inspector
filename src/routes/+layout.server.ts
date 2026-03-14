import { listProjects } from '$lib/server/projects.js';
import { getActiveSessionSummaries, getCachedModels } from '$lib/server/session-manager.js';
import type { LayoutServerLoad } from './$types.js';

export const load: LayoutServerLoad = async ({ depends }) => {
	depends('app:active-sessions');

	const projects = await listProjects();
	const activeSessions = getActiveSessionSummaries();
	const models = getCachedModels();
	return { projects, activeSessions, models };
};
