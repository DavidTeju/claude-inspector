import { SessionManagerError, sendMessage } from '$lib/server/session-manager.js';
import { asObject } from '$lib/server/type-guards.js';
import { json, type RequestHandler } from '@sveltejs/kit';

function isMessageUuid(
	value: unknown
): value is `${string}-${string}-${string}-${string}-${string}` {
	return typeof value === 'string' && /^[^-]+-[^-]+-[^-]+-[^-]+-[^-]+$/.test(value);
}

function asMessageUuid(
	value: unknown
): `${string}-${string}-${string}-${string}-${string}` | undefined {
	return isMessageUuid(value) ? value : undefined;
}

export const POST: RequestHandler = async ({ params, request }) => {
	try {
		const sessionId = params.sessionId;
		if (!sessionId) {
			return json({ error: 'sessionId is required' }, { status: 400 });
		}

		const body = asObject(await request.json());
		if (!body || typeof body.prompt !== 'string') {
			return json({ error: 'prompt is required' }, { status: 400 });
		}

		const messageUuid = asMessageUuid(body.uuid);
		await sendMessage(sessionId, body.prompt, messageUuid);
		return json({ ok: true });
	} catch (error) {
		if (error instanceof SessionManagerError) {
			return json({ error: error.message }, { status: error.status });
		}

		return json({ error: 'Failed to send message' }, { status: 500 });
	}
};
