/**
 * @module
 * Shared protocol types for active Claude SDK sessions, including the server's
 * SSE event contract and the client-visible session state machine.
 */

import type {
	ModelUsage,
	PermissionMode as SDKPermissionMode,
	SDKResultMessage,
	SlashCommand
} from '@anthropic-ai/claude-agent-sdk';
import type { ContentBlock, ThreadMessage, ToolCall } from '../types.js';

export type PermissionMode = SDKPermissionMode;

export type { SlashCommand };

/**
 * Lifecycle states for a live SDK-backed session.
 * - `initializing`: session object exists but the SDK has not emitted init yet
 * - `running`: actively processing tool/model output
 * - `awaiting_permission`: blocked on a permission prompt
 * - `awaiting_input`: blocked on AskUserQuestion UI input
 * - `rate_limited`: Claude rejected execution due to quota/rate limits
 * - `compacting`: Claude is compacting the conversation state
 * - `idle`: ready for the next user turn
 * - `error`: stream/query failed and requires recovery
 * - `closed`: session has been shut down and will not emit more events
 */
export type ActiveSessionState =
	| 'initializing'
	| 'running'
	| 'awaiting_permission'
	| 'awaiting_input'
	| 'rate_limited'
	| 'compacting'
	| 'idle'
	| 'error'
	| 'closed';

export interface PermissionRequest {
	id: string;
	toolName: string;
	input: Record<string, unknown>;
	timestamp: string;
	blockedPath?: string;
	decisionReason?: string;
	agentId?: string;
}

export type PermissionResponse =
	| {
			toolUseId: string;
			behavior: 'allow';
			queuedNote?: string;
	  }
	| {
			toolUseId: string;
			behavior: 'deny';
			message: string;
	  };

export interface AskUserQuestionOption {
	label: string;
	description?: string;
	value?: string;
	preview?: string;
}

export interface AskUserQuestionItem {
	question: string;
	header?: string;
	options: AskUserQuestionOption[];
	multiSelect?: boolean;
}

export interface AskUserQuestionRequest {
	id: string;
	questions: AskUserQuestionItem[];
	timestamp: string;
}

export interface SessionCost {
	totalUsd: number;
	inputTokens: number;
	outputTokens: number;
	cacheReadTokens: number;
	cacheWriteTokens: number;
	modelUsage: Record<string, ModelUsage>;
}

export interface InProgressTurnSnapshot {
	uuid: string;
	/** The final SDK assistant UUID stored in JSONL, used so replay dedup matches persisted history. */
	canonicalUuid?: string;
	streamingText: string;
	streamingThinking: string;
	toolCalls: ToolCall[];
	startedAt: string;
	model?: string;
}

export interface ActiveSessionSummary {
	sessionId: string;
	projectId: string;
	state: ActiveSessionState;
	model: string;
	permissionMode: PermissionMode;
	cost: SessionCost;
	lastActivity: string;
}

export interface InitEvent {
	type: 'init';
	sessionId: string;
	state: ActiveSessionState;
	model: string;
	permissionMode: PermissionMode;
	dangerousPermissionsAllowed: boolean;
	error: string | null;
}

export interface UserEvent {
	type: 'user';
	message: ThreadMessage;
}

export interface AssistantTextEvent {
	type: 'assistant_text';
	uuid: string;
	text: string;
	model?: string;
}

export interface AssistantTextDeltaEvent {
	type: 'assistant_text_delta';
	uuid: string;
	delta: string;
}

export interface AssistantThinkingEvent {
	type: 'assistant_thinking';
	uuid: string;
	thinking: string;
}

export interface ToolUseEvent {
	type: 'tool_use';
	uuid: string;
	toolId: string;
	toolName: string;
	input: Record<string, unknown>;
}

export interface ToolResultEvent {
	type: 'tool_result';
	toolId: string;
	result: string | ContentBlock[];
	isError: boolean;
}

export interface ToolProgressEvent {
	type: 'tool_progress';
	toolUseId: string;
	toolName: string;
	elapsedSeconds: number;
}

export interface PermissionRequestEvent {
	type: 'permission_request';
	request: PermissionRequest;
}

export interface PermissionResolvedEvent {
	type: 'permission_resolved';
	toolUseId: string;
	behavior: 'allow' | 'deny';
}

export interface AskUserQuestionEvent {
	type: 'ask_user_question';
	request: AskUserQuestionRequest;
}

export interface StateChangeEvent {
	type: 'state_change';
	state: ActiveSessionState;
	detail?: string;
}

export interface CostUpdateEvent {
	type: 'cost_update';
	cost: SessionCost;
}

export interface RateLimitEvent {
	type: 'rate_limit';
	status: 'allowed' | 'allowed_warning' | 'rejected';
	resetsAt?: number;
	utilization?: number;
	overageStatus?: 'allowed' | 'allowed_warning' | 'rejected';
}

export interface CompactBoundaryEvent {
	type: 'compact_boundary';
	trigger: 'manual' | 'auto';
}

export interface ResultEvent {
	type: 'result';
	subtype: SDKResultMessage['subtype'];
	result?: string;
	errors?: string[];
	totalCostUsd: number;
	numTurns: number;
	durationMs: number;
}

export interface PromptSuggestionEvent {
	type: 'prompt_suggestion';
	suggestion: string;
}

export interface ErrorEvent {
	type: 'error';
	message: string;
	recoverable: boolean;
}

export interface ReplayMessageEvent {
	type: 'replay_message';
	message: ThreadMessage;
}

export interface ReplayInProgressEvent {
	type: 'replay_in_progress';
	snapshot: InProgressTurnSnapshot;
}

export interface QueuedNoteSentEvent {
	type: 'queued_note_sent';
	noteId: string;
	note: string;
}

export interface ConfigChangeEvent {
	type: 'config_change';
	model?: string;
	permissionMode?: PermissionMode;
}

export interface SlashCommandsEvent {
	type: 'slash_commands';
	commands: SlashCommand[];
}

export interface HeartbeatEvent {
	type: 'heartbeat';
}

export type ClientEvent =
	| InitEvent
	| UserEvent
	| AssistantTextEvent
	| AssistantTextDeltaEvent
	| AssistantThinkingEvent
	| ToolUseEvent
	| ToolResultEvent
	| ToolProgressEvent
	| PermissionRequestEvent
	| PermissionResolvedEvent
	| AskUserQuestionEvent
	| StateChangeEvent
	| CostUpdateEvent
	| RateLimitEvent
	| CompactBoundaryEvent
	| ResultEvent
	| PromptSuggestionEvent
	| ErrorEvent
	| ReplayMessageEvent
	| ReplayInProgressEvent
	| QueuedNoteSentEvent
	| ConfigChangeEvent
	| SlashCommandsEvent
	| HeartbeatEvent;
