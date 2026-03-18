import { json } from '@sveltejs/kit';
import { getDistinctModels, getIndexedProjects } from '$lib/server/session-index-sqlite.js';
import type { RequestHandler } from './$types.js';

export const GET: RequestHandler = async () => {
	return json({
		projects: getIndexedProjects().map((p) => p.displayName),
		models: getDistinctModels()
	});
};
