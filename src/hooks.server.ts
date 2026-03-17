import type { Handle, HandleServerError } from '@sveltejs/kit';
import { startReconciliation } from '$lib/server/reconciler.js';
import { cleanupOrphanedProcesses, shutdownAllSessions } from '$lib/server/session-manager.js';

const globalHooksState = globalThis as typeof globalThis & {
	__claudeInspectorShutdownRegistered?: boolean;
};

// Start background reconciliation on server init
startReconciliation();
cleanupOrphanedProcesses().catch((error) => {
	console.error('[session-manager] orphan cleanup failed:', error);
});

if (!globalHooksState.__claudeInspectorShutdownRegistered) {
	globalHooksState.__claudeInspectorShutdownRegistered = true;

	process.on('SIGTERM', () => {
		void shutdownAllSessions();
	});

	process.on('SIGINT', () => {
		void shutdownAllSessions();
	});
}

export const handle: Handle = async ({ event, resolve }) => {
	return resolve(event);
};

export const handleError: HandleServerError = ({ error, event, status }) => {
	const method = event.request.method;
	const path = event.url.pathname;
	console.error(`[unhandled] ${method} ${path} (${status}):`, error);

	return {
		message: 'An unexpected error occurred'
	};
};
