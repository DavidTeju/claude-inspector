import { json } from '@sveltejs/kit';
import { getDistinctToolNames, getDistinctBranches } from '$lib/server/session-index-sqlite.js';
import type { RequestHandler } from './$types.js';

export const GET: RequestHandler = async () => {
	return json({
		tools: getDistinctToolNames(),
		branches: getDistinctBranches()
	});
};
