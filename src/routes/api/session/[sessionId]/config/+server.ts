import { SessionManagerError, setModel, setPermissionMode } from '$lib/server/session-manager.js';
import type { PermissionMode } from '$lib/shared/active-session-types.js';
import { json, type RequestHandler } from '@sveltejs/kit';

const PERMISSION_MODES = new Set<PermissionMode>([
	'default',
	'acceptEdits',
	'bypassPermissions',
	'plan',
	'dontAsk'
]);

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

		const permissionMode =
			typeof body.permissionMode === 'string' &&
			PERMISSION_MODES.has(body.permissionMode as PermissionMode)
				? (body.permissionMode as PermissionMode)
				: undefined;
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

		return json({ error: 'Failed to update session config' }, { status: 500 });
	}
};
