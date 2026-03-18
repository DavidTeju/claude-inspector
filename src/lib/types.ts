/**
 * @module
 * Shared domain types used by the client and server when they talk about projects,
 * indexed sessions, parsed message content, and search results.
 */

/** Current on-disk version for sessions-index.json entries written by the app. */
export const SESSION_INDEX_VERSION = 2;

/** A Claude Code project directory with aggregated session metadata */
export interface Project {
	/** Mangled project identifier derived from the Claude storage directory name. */
	id: string;
	displayName: string;
	path: string;
	sessionCount: number;
	lastModified: string;
}

/** A session entry as stored in the local index or derived directly from JSONL scanning */
export interface SessionEntry {
	/** Route-safe identifier used in links and keys. */
	sessionId: string;
	/** Raw JSONL filename without extension. Useful when sessionId is route-encoded. */
	displaySessionId?: string;
	fullPath: string;
	/** Project-relative JSONL path, including subagent directories when applicable. */
	relativePath?: string;
	fileMtime: number;
	firstPrompt: string;
	summary: string;
	messageCount: number;
	created: string;
	modified: string;
	gitBranch: string;
	projectPath: string;
	/** True for Claude Code sidechain turns that are normally hidden from the main transcript. */
	isSidechain: boolean;
	/** True when this entry came from a nested `parent/subagents/child.jsonl` session file. */
	isSubagent?: boolean;
	parentSessionId?: string;
	/** Explicit UI title from a `custom-title` record; preferred over generated/native labels. */
	customTitle?: string;
	/** Summary written by Claude Code itself before Inspector applies display-specific truncation. */
	nativeSummary?: string;
	/** Most recent human-authored prompt, including metadata fallbacks when the first prompt is absent. */
	lastPrompt?: string;
}

export interface SessionIndex {
	version: number;
	entries: SessionEntry[];
}

export interface TextContentBlock {
	type: 'text';
	text: string;
}

export interface ToolUseContentBlock {
	type: 'tool_use';
	id: string;
	name: string;
	/** JSON input payload sent to the tool. */
	input: Record<string, unknown>;
	caller?: string;
}

export interface ToolResultContentBlock {
	type: 'tool_result';
	/** Camel-cased Inspector view of the stored `tool_use_id` field. */
	toolUseId: string;
	/** Tool result payload, which may itself contain nested structured blocks. */
	content?: string | ContentBlock[];
	isError?: boolean;
}

export interface ThinkingContentBlock {
	type: 'thinking';
	/** Hidden reasoning content emitted by the SDK/JSONL transcript. */
	thinking: string;
	signature?: string;
}

export interface ImageContentBlock {
	type: 'image';
	/** Inline image payload preserved for pasted screenshots and other user-submitted media. */
	source: {
		type?: string;
		mediaType?: string;
		data?: string;
	};
}

/**
 * Discriminated union of normalized content block variants used by the Inspector UI.
 * Unlike `ClaudeContentBlock` in `session-schema.ts`, this app-facing union uses
 * Inspector camelCase field names and excludes unknown/raw-only variants.
 */
export type ContentBlock =
	| TextContentBlock
	| ToolUseContentBlock
	| ToolResultContentBlock
	| ThinkingContentBlock
	| ImageContentBlock;

export interface ToolResultEntry {
	content: string | ContentBlock[];
	isError: boolean;
}

export type ToolResultMap = Map<string, ToolResultEntry>;

/** A paired tool_use call with its corresponding tool_result */
export interface ToolCall {
	id: string;
	name: string;
	input: Record<string, unknown>;
	result?: ToolResultEntry;
}

/** A processed message for display, with extracted text, tool calls, and thinking blocks */
export interface ThreadMessage {
	uuid: string;
	role: 'user' | 'assistant';
	timestamp: string;
	textContent: string;
	toolCalls: ToolCall[];
	thinkingBlocks: string[];
	rawContent: string | ContentBlock[];
	model?: string;
}

/** Content segments used to group consecutive assistant messages */
export interface ContentSegment {
	thinkingBlocks: string[];
	textContent: string;
	toolCalls: ToolCall[];
}

export interface SearchResult {
	projectId: string;
	projectName: string;
	sessionId: string;
	sessionSummary: string;
	firstPrompt: string;
	snippets: string[];
	modified: string;
	/** Search ranking score; indexed search uses FTS relevance while raw fallback uses prompt/summary weights. */
	relevance: number;
}
