import { json } from '@sveltejs/kit';
import { searchSessions } from '$lib/server/search.js';
import type { RequestHandler } from './$types.js';

export const GET: RequestHandler = async ({ url }) => {
	const query = url.searchParams.get('q') || '';
	const projectFilter = url.searchParams.get('project') || undefined;

	if (!query || query.length < 2) {
		return json({ results: [] });
	}

	const results = await searchSessions(query, projectFilter);

	return json({ results: results.slice(0, 20) });
};
