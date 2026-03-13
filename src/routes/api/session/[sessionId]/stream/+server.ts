import type { ClientEvent } from '$lib/shared/active-session-types.js';
import { getActiveSession, subscribe } from '$lib/server/session-manager.js';
import { json, type RequestHandler } from '@sveltejs/kit';

const encoder = new TextEncoder();

function encodeEvent(event: ClientEvent): Uint8Array {
	return encoder.encode(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
}

export const GET: RequestHandler = async ({ params }) => {
	const sessionId = params.sessionId;
	if (!sessionId) {
		return json({ error: 'sessionId is required' }, { status: 400 });
	}

	const session = getActiveSession(sessionId);
	if (!session) {
		return json({ error: 'Active session not found' }, { status: 404 });
	}

	let unsubscribe: (() => void) | null = null;

	const stream = new ReadableStream({
		start(controller) {
			controller.enqueue(
				encodeEvent({
					type: 'init',
					sessionId: session.sessionId,
					state: session.state,
					model: session.model,
					permissionMode: session.permissionMode
				})
			);

			for (const message of session.messageBuffer) {
				controller.enqueue(
					encodeEvent({
						type: 'replay_message',
						message
					})
				);
			}

			if (session.inProgressTurn) {
				controller.enqueue(
					encodeEvent({
						type: 'replay_in_progress',
						snapshot: session.inProgressTurn
					})
				);
			}

			if (session.pendingPermission) {
				controller.enqueue(
					encodeEvent({
						type: 'permission_request',
						request: session.pendingPermission.request
					})
				);
			}

			if (session.pendingQuestion) {
				controller.enqueue(
					encodeEvent({
						type: 'ask_user_question',
						request: session.pendingQuestion.request
					})
				);
			}

			unsubscribe = subscribe(session.sessionId, controller);
		},
		cancel() {
			unsubscribe?.();
		}
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			Connection: 'keep-alive'
		}
	});
};
