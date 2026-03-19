import { json, type RequestHandler } from '@sveltejs/kit';
import { getConfig } from '$lib/server/config.js';
import {
	SessionManagerError,
	resumeSession,
	startNewSession
} from '$lib/server/session-manager.js';
import { asObject, asOptionalString } from '$lib/server/type-guards.js';
import type { PermissionMode } from '$lib/shared/active-session-types.js';
import { isPermissionMode } from '$lib/shared/permission-modes.js';

function asPermissionMode(value: unknown): PermissionMode | undefined {
	return isPermissionMode(value) ? value : undefined;
}

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = asObject(await request.json());
		if (!body) {
			return json({ error: 'Request body must be a JSON object' }, { status: 400 });
		}

		const projectId = asOptionalString(body.projectId);
		const projectPath = asOptionalString(body.projectPath);
		const prompt = asOptionalString(body.prompt);
		if ((!projectId && !projectPath) || !prompt) {
			return json({ error: '(projectId or projectPath) and prompt are required' }, { status: 400 });
		}

		const config = await getConfig();
		const permissionMode = asPermissionMode(body.permissionMode) ?? config.defaultPermissionMode;
		const model = asOptionalString(body.model) ?? config.defaultModel;
		const sdkSessionId = asOptionalString(body.sdkSessionId);

		let session;
		if (sdkSessionId) {
			if (!projectId) {
				return json({ error: 'projectId is required to resume a session' }, { status: 400 });
			}
			session = await resumeSession({
				projectId,
				prompt,
				sessionId: sdkSessionId,
				permissionMode,
				model
			});
		} else {
			session = await startNewSession({
				projectId,
				projectPath,
				prompt,
				permissionMode,
				model
			});
		}

		return json({ sessionId: session.sessionId, projectId: session.projectId });
	} catch (error) {
		if (error instanceof SessionManagerError) {
			return json({ error: error.message }, { status: error.status });
		}

		const message = error instanceof Error ? error.message : 'Failed to start session';
		return json({ error: message }, { status: 500 });
	}
};
