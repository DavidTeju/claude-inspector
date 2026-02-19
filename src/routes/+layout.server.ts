import { listProjects } from '$lib/server/projects.js';
import type { LayoutServerLoad } from './$types.js';

export const load: LayoutServerLoad = async () => {
	const projects = await listProjects();
	return { projects };
};
