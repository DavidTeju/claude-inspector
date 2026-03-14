import { json, type RequestHandler } from '@sveltejs/kit';
import { SessionManagerError, respondToQuestion } from '$lib/server/session-manager.js';

function asObject(value: unknown): Record<string, unknown> | null {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
	return value as Record<string, unknown>;
}

export const POST: RequestHandler = async ({ params, request }) => {
	try {
		const sessionId = params.sessionId;
		if (!sessionId) {
			return json({ error: 'sessionId is required' }, { status: 400 });
		}

		const body = asObject(await request.json());
		if (!body || !('answers' in body)) {
			return json({ error: 'answers is required' }, { status: 400 });
		}

		await respondToQuestion(sessionId, body.answers);
		return json({ ok: true });
	} catch (error) {
		if (error instanceof SessionManagerError) {
			return json({ error: error.message }, { status: error.status });
		}

		const message = error instanceof Error ? error.message : 'Failed to answer question';
		console.error('[question] Failed to answer question:', error);
		return json({ error: message }, { status: 500 });
	}
};
