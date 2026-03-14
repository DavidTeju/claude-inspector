import { json, type RequestHandler } from '@sveltejs/kit';
import { getActiveSessionSummaries } from '$lib/server/session-manager.js';

export const GET: RequestHandler = async () => {
	return json(getActiveSessionSummaries());
};
