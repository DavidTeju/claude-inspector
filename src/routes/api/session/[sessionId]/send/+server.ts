import { json, type RequestHandler } from '@sveltejs/kit';
import { SessionManagerError, sendMessage } from '$lib/server/session-manager.js';
import { asObject } from '$lib/server/type-guards.js';

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

		const message = error instanceof Error ? error.message : 'Failed to send message';
		console.error('[send] Failed to send message:', error);
		return json({ error: message }, { status: 500 });
	}
};
