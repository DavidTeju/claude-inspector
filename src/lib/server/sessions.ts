import type { SessionEntry } from '../types.js';
import { getReconciledSessions, reconcileProjectNow } from './reconciler.js';

/**
 * Returns all sessions for a project, sorted by modified date (newest first).
 * Falls back to an on-demand project reconciliation if the background cache is cold.
 */
export async function getSessionsForProject(projectId: string): Promise<SessionEntry[]> {
	const reconciled = getReconciledSessions(projectId);
	if (reconciled) return reconciled;

	return reconcileProjectNow(projectId);
}
