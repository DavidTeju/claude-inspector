import { searchSessions } from '$lib/server/search.js';
import type { PageServerLoad } from './$types.js';

export const load: PageServerLoad = async ({ url }) => {
	const query = url.searchParams.get('q') || '';
	const projectFilter = url.searchParams.get('project') || undefined;

	if (!query) {
		return { query, results: [], projectFilter };
	}

	const results = await searchSessions(query, projectFilter);

	return {
		query,
		results,
		projectFilter
	};
};
