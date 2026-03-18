/**
 * @module
 * Barrel re-exports for the session index subsystem.
 * Preserves the original import path while the implementation is split across:
 *   - `session-index-types.ts`    — shared interfaces
 *   - `session-fact-extraction.ts` — JSONL record walking and fact extraction
 *   - `session-index-db.ts`       — SQLite queries, persistence, and schema
 */

export { buildIndexedSessionData } from './session-fact-extraction.js';
export {
	deleteIndexedProjects,
	getDistinctBranches,
	getDistinctToolNames,
	getIndexedProjectIds,
	getIndexedProjects,
	getIndexedSessionMeta,
	getIndexedSessions,
	getIndexedSessionsByPath,
	getReconcileStateByPath,
	persistProjectIndex,
	searchIndexedSessions,
	updateIndexedSessionSummary
} from './session-index-db.js';
export type {
	IndexedSearchQuery,
	IndexedSearchSession,
	IndexedSessionData,
	IndexedSessionMeta,
	StoredIndexedSession
} from './session-index-types.js';
