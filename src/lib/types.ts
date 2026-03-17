/** Current on-disk version for sessions-index.json entries written by the app. */
export const SESSION_INDEX_VERSION = 2;

/** A Claude Code project directory with aggregated session metadata */
export interface Project {
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
	relativePath?: string;
	fileMtime: number;
	firstPrompt: string;
	summary: string;
	messageCount: number;
	created: string;
	modified: string;
	gitBranch: string;
	projectPath: string;
	isSidechain: boolean;
	isSubagent?: boolean;
	parentSessionId?: string;
	customTitle?: string;
	nativeSummary?: string;
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
	input: Record<string, unknown>;
	caller?: string;
}

export interface ToolResultContentBlock {
	type: 'tool_result';
	toolUseId: string;
	content?: string | ContentBlock[];
	isError?: boolean;
}

export interface ThinkingContentBlock {
	type: 'thinking';
	thinking: string;
	signature?: string;
}

export interface ImageContentBlock {
	type: 'image';
	source: {
		type?: string;
		mediaType?: string;
		data?: string;
	};
}

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
	relevance: number;
}
