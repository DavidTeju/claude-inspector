import { getConfig, saveConfig } from '$lib/server/config.js';
import { startReconciliation } from '$lib/server/reconciler.js';
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types.js';

export const load: PageServerLoad = async () => {
	const config = await getConfig();
	return {
		hasApiKey: !!config.anthropicApiKey,
		// Mask the key for display
		maskedKey: config.anthropicApiKey
			? config.anthropicApiKey.slice(0, 10) + '...' + config.anthropicApiKey.slice(-4)
			: ''
	};
};

export const actions: Actions = {
	save: async ({ request }) => {
		const formData = await request.formData();
		const apiKey = formData.get('apiKey');

		if (typeof apiKey !== 'string') {
			return fail(400, { error: 'Invalid API key' });
		}

		await saveConfig({ anthropicApiKey: apiKey.trim() });

		// Restart reconciliation to generate missing summaries
		if (apiKey.trim()) {
			startReconciliation();
		}

		return { success: true };
	},
	clear: async () => {
		await saveConfig({ anthropicApiKey: '' });
		return { success: true, cleared: true };
	}
};
