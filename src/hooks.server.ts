import { startReconciliation } from '$lib/server/reconciler.js';
import type { Handle } from '@sveltejs/kit';

// Start background reconciliation on server init
startReconciliation();

export const handle: Handle = async ({ event, resolve }) => {
	return resolve(event);
};
