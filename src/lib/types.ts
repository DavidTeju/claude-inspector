/** A Claude Code project directory with aggregated session metadata */
export interface Project {
	id: string;
	displayName: string;
	path: string;
	sessionCount: number;
	lastModified: string;
}

/** A session entry as stored in sessions-index.json or derived from JSONL scanning */
export interface SessionEntry {
	sessionId: string;
	fullPath: string;
	fileMtime: number;
	firstPrompt: string;
	summary: string;
	messageCount: number;
	created: string;
	modified: string;
	gitBranch: string;
	projectPath: string;
	isSidechain: boolean;
}

export interface SessionIndex {
	version: number;
	entries: SessionEntry[];
}

/** A content block within a Claude message (text, tool_use, tool_result, thinking, or image) */
export interface ContentBlock {
	type: 'text' | 'tool_use' | 'tool_result' | 'thinking' | 'image';
	text?: string;
	id?: string;
	name?: string;
	input?: Record<string, unknown>;
	tool_use_id?: string;
	content?: string | ContentBlock[];
	is_error?: boolean;
	thinking?: string;
}

export interface Message {
	role: 'user' | 'assistant';
	content: string | ContentBlock[];
	model?: string;
}

export interface SessionRecord {
	type:
		| 'user'
		| 'assistant'
		| 'summary'
		| 'progress'
		| 'system'
		| 'file-history-snapshot'
		| 'queue-operation';
	uuid: string;
	parentUuid: string | null;
	sessionId: string;
	timestamp: string;
	message: Message;
	isSidechain?: boolean;
	cwd?: string;
	version?: string;
	gitBranch?: string;
}

/** A paired tool_use call with its corresponding tool_result */
export interface ToolCall {
	id: string;
	name: string;
	input: Record<string, unknown>;
	result?: string | ContentBlock[];
	isError?: boolean;
}

/** A processed message for display, with extracted text, tool calls, and thinking blocks */
export interface ThreadMessage {
	uuid: string;
	role: 'user' | 'assistant';
	timestamp: string;
	textContent: string;
	toolCalls: ToolCall[];
	toolResults: Map<string, { content: string | ContentBlock[]; isError: boolean }>;
	thinkingBlocks: string[];
	rawContent: string | ContentBlock[];
	model?: string;
}

export interface SearchResult {
	projectId: string;
	projectName: string;
	sessionId: string;
	sessionSummary: string;
	firstPrompt: string;
	snippets: string[];
	modified: string;
}
