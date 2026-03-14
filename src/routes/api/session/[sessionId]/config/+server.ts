import { json, type RequestHandler } from '@sveltejs/kit';
import { SessionManagerError, setModel, setPermissionMode } from '$lib/server/session-manager.js';
import { isPermissionMode } from '$lib/shared/permission-modes.js';

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
		if (!body) {
			return json({ error: 'Request body must be a JSON object' }, { status: 400 });
		}

		const permissionMode = isPermissionMode(body.permissionMode) ? body.permissionMode : undefined;
		const model = typeof body.model === 'string' ? body.model.trim() : undefined;

		if (!permissionMode && model === undefined) {
			return json({ error: 'permissionMode or model is required' }, { status: 400 });
		}

		if (permissionMode) {
			await setPermissionMode(sessionId, permissionMode);
		}

		if (model !== undefined) {
			await setModel(sessionId, model);
		}

		return json({ ok: true });
	} catch (error) {
		if (error instanceof SessionManagerError) {
			return json({ error: error.message }, { status: error.status });
		}

		const message = error instanceof Error ? error.message : 'Failed to update session config';
		console.error('[config] Failed to update session config:', error);
		return json({ error: message }, { status: 500 });
	}
};
