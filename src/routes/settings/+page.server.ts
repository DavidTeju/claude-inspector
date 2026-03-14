import { fail } from '@sveltejs/kit';
import { HTTP_BAD_REQUEST } from '$lib/constants.js';
import { getConfig, saveConfig } from '$lib/server/config.js';
import { startReconciliation } from '$lib/server/reconciler.js';
import type { PermissionMode } from '$lib/shared/active-session-types.js';
import { isPermissionMode } from '$lib/shared/permission-modes.js';
import type { Actions, PageServerLoad } from './$types.js';

const API_KEY_PREFIX_LEN = 10;
const API_KEY_SUFFIX_LEN = 4;
const MIN_PERMISSION_TIMEOUT = 1;
const MAX_PERMISSION_TIMEOUT = 60;
const MIN_REAP_INTERVAL = 5;
const MAX_REAP_INTERVAL = 1440;

export const load: PageServerLoad = async () => {
	const config = await getConfig();
	return {
		hasApiKey: !!config.anthropicApiKey,
		maskedKey: config.anthropicApiKey
			? config.anthropicApiKey.slice(0, API_KEY_PREFIX_LEN) +
				'...' +
				config.anthropicApiKey.slice(-API_KEY_SUFFIX_LEN)
			: '',
		defaultPermissionMode: config.defaultPermissionMode,
		defaultModel: config.defaultModel,
		permissionTimeoutMinutes: config.permissionTimeoutMinutes,
		sessionReapMinutes: config.sessionReapMinutes
	};
};

export const actions: Actions = {
	save: async ({ request }) => {
		const formData = await request.formData();
		const apiKey = formData.get('apiKey');

		if (typeof apiKey !== 'string') {
			return fail(HTTP_BAD_REQUEST, { error: 'Invalid API key' });
		}

		await saveConfig({ anthropicApiKey: apiKey.trim() });

		// Restart reconciliation to generate missing summaries
		if (apiKey.trim()) {
			startReconciliation();
		}

		return { success: true, section: 'apiKey' as const };
	},
	clear: async () => {
		await saveConfig({ anthropicApiKey: '' });
		return { success: true, cleared: true, section: 'apiKey' as const };
	},
	saveSessionConfig: async ({ request }) => {
		const formData = await request.formData();

		const rawPermissionMode = formData.get('permissionMode');
		const rawModel = formData.get('model');
		const permissionMode = typeof rawPermissionMode === 'string' ? rawPermissionMode : '';
		const model = typeof rawModel === 'string' ? rawModel : '';
		const timeoutRaw = Number(formData.get('permissionTimeout'));
		const reapRaw = Number(formData.get('sessionReap'));

		if (permissionMode && !isPermissionMode(permissionMode)) {
			return fail(HTTP_BAD_REQUEST, {
				error: 'Invalid permission mode',
				section: 'session' as const
			});
		}

		const permissionTimeoutMinutes = Number.isFinite(timeoutRaw)
			? Math.max(MIN_PERMISSION_TIMEOUT, Math.min(MAX_PERMISSION_TIMEOUT, timeoutRaw))
			: undefined;

		const sessionReapMinutes = Number.isFinite(reapRaw)
			? Math.max(MIN_REAP_INTERVAL, Math.min(MAX_REAP_INTERVAL, reapRaw))
			: undefined;

		await saveConfig({
			...(permissionMode ? { defaultPermissionMode: permissionMode as PermissionMode } : {}),
			defaultModel: model?.trim() ?? '',
			...(permissionTimeoutMinutes !== undefined ? { permissionTimeoutMinutes } : {}),
			...(sessionReapMinutes !== undefined ? { sessionReapMinutes } : {})
		});

		return { success: true, section: 'session' as const };
	}
};
