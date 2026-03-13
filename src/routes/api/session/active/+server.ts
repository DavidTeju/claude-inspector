import { getActiveSessionSummaries } from '$lib/server/session-manager.js';
import { json, type RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async () => {
	return json(getActiveSessionSummaries());
};
