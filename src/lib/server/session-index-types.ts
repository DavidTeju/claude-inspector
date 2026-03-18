/**
 * @module
 * Shared interfaces for the session index subsystem.
 * These types are the contract between fact extraction (which produces
 * `IndexedSessionData`) and the SQLite persistence/query layer (which consumes it).
 */

import type { SessionEntry } from '../types.js';

/** Tool usage fact extracted from assistant content for storage in `session_tools`. */
export interface IndexedToolFact {
	assistantUuid?: string;
	toolUseId: string;
	toolName: string;
	caller?: string;
	inputJson: string;
	resultText?: string;
	isError: boolean;
}

/** Progress/system event extracted into a queryable row for `session_progress`. */
export interface IndexedProgressFact {
	recordIndex: number;
	uuid?: string;
	timestamp?: string;
	progressType?: string;
	label?: string;
	payloadJson?: string;
}

export interface IndexedFileFact {
	recordIndex: number;
	path: string;
	kind: string;
}

export interface IndexedSearchDocument {
	titleText: string;
	promptText: string;
	bodyText: string;
	toolText: string;
	branchText: string;
	systemText: string;
}

export interface TokenUsage {
	tokenInput: number;
	tokenOutput: number;
	tokenCacheRead: number;
	tokenCacheWrite: number;
}

export interface IndexedSessionData {
	entry: SessionEntry;
	sizeBytes: number;
	tokenInput: number;
	tokenOutput: number;
	tokenCacheRead: number;
	tokenCacheWrite: number;
	hasApiError: boolean;
	hasCompaction: boolean;
	models: string[];
	tools: IndexedToolFact[];
	progressEvents: IndexedProgressFact[];
	fileFacts: IndexedFileFact[];
	searchDocument: IndexedSearchDocument;
}

export interface StoredIndexedSession {
	entry: SessionEntry;
	sizeBytes: number;
}

export interface IndexedSessionMeta {
	summary: string;
	firstPrompt: string;
	messageCount: number;
	modified: string;
}

export interface IndexedSearchSession extends IndexedSessionMeta {
	projectId: string;
	sessionId: string;
	searchText: string;
	relevance: number;
}

export interface FilterTerm {
	value: string;
	negated: boolean;
}

export interface IndexedSearchQuery {
	textTerms: string[];
	phraseTerms: string[];
	projectFilter?: string;
	projects: FilterTerm[];
	models: FilterTerm[];
	errorFilter: 'include' | 'exclude' | null;
	subagentFilter: 'include' | 'exclude' | null;
	dateAfter?: string;
	dateBefore?: string;
}
