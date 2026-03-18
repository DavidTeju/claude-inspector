import { json, type RequestHandler } from '@sveltejs/kit';
import {
	getActiveSession,
	getCachedSlashCommands,
	subscribe
} from '$lib/server/session-manager.js';
import type { ClientEvent } from '$lib/shared/active-session-types.js';

const encoder = new TextEncoder();

function encodeEvent(event: ClientEvent): Uint8Array {
	return encoder.encode(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
}

function enqueueEvent(
	controller: ReadableStreamDefaultController<Uint8Array>,
	event: ClientEvent
): boolean {
	try {
		controller.enqueue(encodeEvent(event));
		return true;
	} catch {
		return false;
	}
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
			const subscription = subscribe(session.sessionId, controller);
			unsubscribe = subscription.unsubscribe;

			if (
				!enqueueEvent(controller, {
					type: 'init',
					sessionId: subscription.snapshot.sessionId,
					state: subscription.snapshot.state,
					model: subscription.snapshot.model,
					permissionMode: subscription.snapshot.permissionMode,
					dangerousPermissionsAllowed: subscription.snapshot.dangerousPermissionsAllowed,
					error: subscription.snapshot.lastError ?? null
				})
			) {
				unsubscribe();
				return;
			}

			for (const message of subscription.snapshot.messages) {
				if (
					!enqueueEvent(controller, {
						type: 'replay_message',
						message
					})
				) {
					unsubscribe();
					return;
				}
			}

			if (
				subscription.snapshot.inProgress &&
				!enqueueEvent(controller, {
					type: 'replay_in_progress',
					snapshot: subscription.snapshot.inProgress
				})
			) {
				unsubscribe();
				return;
			}

			if (
				subscription.snapshot.pendingPermission &&
				!enqueueEvent(controller, {
					type: 'permission_request',
					request: subscription.snapshot.pendingPermission
				})
			) {
				unsubscribe();
				return;
			}

			if (
				subscription.snapshot.pendingQuestion &&
				!enqueueEvent(controller, {
					type: 'ask_user_question',
					request: subscription.snapshot.pendingQuestion
				})
			) {
				unsubscribe();
				return;
			}

			// Send cached slash commands if available
			const slashCommands = getCachedSlashCommands();
			if (
				slashCommands.length > 0 &&
				!enqueueEvent(controller, {
					type: 'slash_commands',
					commands: slashCommands
				})
			) {
				unsubscribe();
				return;
			}

			subscription.completeReplay();
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
