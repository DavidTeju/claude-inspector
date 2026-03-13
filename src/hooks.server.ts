import { startReconciliation } from '$lib/server/reconciler.js';
import { cleanupOrphanedProcesses, shutdownAllSessions } from '$lib/server/session-manager.js';
import type { Handle } from '@sveltejs/kit';

const globalHooksState = globalThis as typeof globalThis & {
	__claudeInspectorShutdownRegistered?: boolean;
};

// Start background reconciliation on server init
startReconciliation();
void cleanupOrphanedProcesses().catch((error) => {
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
