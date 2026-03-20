import { getRecentSessions } from '$lib/server/session-index-db.js';
import type { PageServerLoad } from './$types.js';

const RECENT_SESSIONS_LIMIT = 20;

export const load: PageServerLoad = async ({ url }) => {
	const selectedProjectId = url.searchParams.get('project') || null;
	const recentSessions = getRecentSessions(RECENT_SESSIONS_LIMIT, selectedProjectId ?? undefined);
	return { recentSessions, selectedProjectId };
};
