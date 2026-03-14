import { json, type RequestHandler } from '@sveltejs/kit';
import { SessionManagerError, respondToPermission } from '$lib/server/session-manager.js';
import type { PermissionResponse } from '$lib/shared/active-session-types.js';

function asObject(value: unknown): Record<string, unknown> | null {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
	return value as Record<string, unknown>;
}

function parsePermissionResponse(value: unknown): PermissionResponse | null {
	const body = asObject(value);
	if (!body || typeof body.toolUseId !== 'string' || typeof body.behavior !== 'string') {
		return null;
	}

	if (body.behavior === 'allow') {
		if (body.queuedNote != null && typeof body.queuedNote !== 'string') {
			return null;
		}

		return {
			toolUseId: body.toolUseId,
			behavior: 'allow',
			queuedNote: typeof body.queuedNote === 'string' ? body.queuedNote : undefined
		};
	}

	if (body.behavior === 'deny' && typeof body.message === 'string') {
		return {
			toolUseId: body.toolUseId,
			behavior: 'deny',
			message: body.message
		};
	}

	return null;
}

export const POST: RequestHandler = async ({ params, request }) => {
	try {
		const sessionId = params.sessionId;
		if (!sessionId) {
			return json({ error: 'sessionId is required' }, { status: 400 });
		}

		const decision = parsePermissionResponse(await request.json());
		if (!decision) {
			return json({ error: 'Invalid permission response body' }, { status: 400 });
		}

		const result = await respondToPermission(sessionId, decision);
		return json({ ok: true, ...result });
	} catch (error) {
		if (error instanceof SessionManagerError) {
			return json({ error: error.message }, { status: error.status });
		}

		const message = error instanceof Error ? error.message : 'Failed to resolve permission request';
		console.error('[permission] Failed to resolve permission request:', error);
		return json({ error: message }, { status: 500 });
	}
};
