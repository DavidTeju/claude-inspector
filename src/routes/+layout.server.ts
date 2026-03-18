import { getConfig } from '$lib/server/config.js';
import { listProjects } from '$lib/server/projects.js';
import { getActiveSessionSummaries, getCachedModels } from '$lib/server/session-manager.js';
import type { LayoutServerLoad } from './$types.js';

export const load: LayoutServerLoad = async ({ depends }) => {
	depends('app:active-sessions');

	const [projects, config] = await Promise.all([listProjects(), getConfig()]);
	const activeSessions = getActiveSessionSummaries();
	const models = getCachedModels();
	return {
		projects,
		activeSessions,
		models,
		defaultPermissionMode: config.defaultPermissionMode,
		defaultModel: config.defaultModel
	};
};
