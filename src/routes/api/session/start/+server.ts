import { getConfig } from '$lib/server/config.js';
import {
	SessionManagerError,
	resumeSession,
	startNewSession
} from '$lib/server/session-manager.js';
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

function asOptionalString(value: unknown): string | undefined {
	return typeof value === 'string' ? value.trim() : undefined;
}

function asPermissionMode(value: unknown): PermissionMode | undefined {
	if (typeof value !== 'string') return undefined;
	return PERMISSION_MODES.has(value as PermissionMode) ? (value as PermissionMode) : undefined;
}

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = asObject(await request.json());
		if (!body) {
			return json({ error: 'Request body must be a JSON object' }, { status: 400 });
		}

		const projectId = asOptionalString(body.projectId);
		const prompt = asOptionalString(body.prompt);
		if (!projectId || !prompt) {
			return json({ error: 'projectId and prompt are required' }, { status: 400 });
		}

		const config = await getConfig();
		const permissionMode = asPermissionMode(body.permissionMode) ?? config.defaultPermissionMode;
		const model = asOptionalString(body.model) ?? config.defaultModel;
		const sdkSessionId = asOptionalString(body.sdkSessionId);

		const session = sdkSessionId
			? await resumeSession({
					projectId,
					prompt,
					sessionId: sdkSessionId,
					permissionMode,
					model
				})
			: await startNewSession({
					projectId,
					prompt,
					permissionMode,
					model
				});

		return json({ sessionId: session.sessionId });
	} catch (error) {
		if (error instanceof SessionManagerError) {
			return json({ error: error.message }, { status: error.status });
		}

		return json({ error: 'Failed to start session' }, { status: 500 });
	}
};
