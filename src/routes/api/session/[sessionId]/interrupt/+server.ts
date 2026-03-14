import { json, type RequestHandler } from '@sveltejs/kit';
import { SessionManagerError, interruptSession } from '$lib/server/session-manager.js';

export const POST: RequestHandler = async ({ params }) => {
	try {
		const sessionId = params.sessionId;
		if (!sessionId) {
			return json({ error: 'sessionId is required' }, { status: 400 });
		}

		await interruptSession(sessionId);
		return json({ ok: true });
	} catch (error) {
		if (error instanceof SessionManagerError) {
			return json({ error: error.message }, { status: error.status });
		}

		const message = error instanceof Error ? error.message : 'Failed to interrupt session';
		console.error('[interrupt] Failed to interrupt session:', error);
		return json({ error: message }, { status: 500 });
	}
};
