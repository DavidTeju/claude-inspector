/**
 * @module
 * Normalized schema for Claude session JSONL records. The parser separates
 * thread records from metadata records and preserves Inspector-specific logic
 * around filtered `isMeta` user messages, including the image-only records that
 * are still exposed as user-visible turns.
 */

type JsonObject = Record<string, unknown>;

/** All normalized record types that may appear in a Claude session JSONL file. */
export type SessionRecordType =
	| 'user'
	| 'assistant'
	| 'progress'
	| 'system'
	| 'summary'
	| 'custom-title'
	| 'last-prompt'
	| 'agent-name'
	| 'queue-operation'
	| 'file-history-snapshot';

export interface ParsedSessionRecord {
	record: ClaudeSessionRecord;
	source: {
		recordIndex: number;
		lineNumber: number;
	};
}

export interface TextBlock {
	type: 'text';
	text: string;
}

export interface ToolUseBlock {
	type: 'tool_use';
	id: string;
	name: string;
	input: Record<string, unknown>;
	caller?: string;
}

export interface ToolResultBlock {
	type: 'tool_result';
	tool_use_id: string;
	content?: string | ClaudeContentBlock[];
	is_error?: boolean;
}

export interface ThinkingBlock {
	type: 'thinking';
	thinking: string;
	signature?: string;
}

export interface ImageBlock {
	type: 'image';
	source: {
		type?: string;
		media_type?: string;
		data?: string;
	};
}

export interface UnknownContentBlock {
	type: 'unknown';
	originalType: string;
	payload: JsonObject;
}

export type ClaudeContentBlock =
	| TextBlock
	| ToolUseBlock
	| ToolResultBlock
	| ThinkingBlock
	| ImageBlock
	| UnknownContentBlock;

export type ClaudeMessageContent = string | ClaudeContentBlock[];

export interface UserMessage {
	role: 'user';
	content: ClaudeMessageContent;
}

export interface AssistantMessage {
	role: 'assistant';
	content: ClaudeMessageContent;
	model?: string;
	id?: string;
	type?: string;
	stop_reason?: string | null;
	usage?: JsonObject;
}

interface BaseRecord {
	type: SessionRecordType;
	sessionId?: string;
	timestamp?: string;
	cwd?: string;
	gitBranch?: string;
	version?: string;
}

interface ThreadRecordBase extends BaseRecord {
	uuid: string;
	parentUuid: string | null;
	sessionId: string;
	timestamp: string;
	isSidechain?: boolean;
	userType?: string;
	agentId?: string;
	slug?: string;
	teamName?: string;
}

interface ApiUserRecordBase extends ThreadRecordBase {
	type: 'user';
	message: UserMessage;
	promptId?: string;
	permissionMode?: string;
	isMeta?: boolean;
	isCompactSummary?: boolean;
	isVisibleInTranscriptOnly?: boolean;
}

export interface UserRecord extends ApiUserRecordBase {
	recordKind: 'user';
}

export interface ToolResultRecord extends ApiUserRecordBase {
	recordKind: 'tool_result';
	sourceToolUseID?: string;
	sourceToolAssistantUUID?: string;
}

export interface AssistantRecord extends ThreadRecordBase {
	type: 'assistant';
	message: AssistantMessage;
	requestId?: string;
	isApiErrorMessage?: boolean;
	apiError?: unknown;
	error?: unknown;
}

export interface ProgressRecord extends ThreadRecordBase {
	type: 'progress';
	data?: JsonObject;
}

export interface SystemRecord extends ThreadRecordBase {
	type: 'system';
	subtype?: string;
	content?: string;
	data?: JsonObject;
	durationMs?: number;
	logicalParentUuid?: string;
	compactMetadata?: JsonObject;
}

interface MetadataRecordBase extends BaseRecord {
	sessionId?: string;
	timestamp?: string;
}

export interface SummaryRecord extends MetadataRecordBase {
	type: 'summary';
	summary: string;
	leafUuid?: string;
}

export interface CustomTitleRecord extends MetadataRecordBase {
	type: 'custom-title';
	customTitle: string;
}

export interface LastPromptRecord extends MetadataRecordBase {
	type: 'last-prompt';
	lastPrompt: string;
}

export interface AgentNameRecord extends MetadataRecordBase {
	type: 'agent-name';
	agentName: string;
}

export interface QueueOperationRecord extends MetadataRecordBase {
	type: 'queue-operation';
	operation?: string;
	content?: unknown;
}

export interface FileHistorySnapshotRecord extends MetadataRecordBase {
	type: 'file-history-snapshot';
	messageId?: string;
	isSnapshotUpdate?: boolean;
	snapshot?: JsonObject;
}

export type ThreadRecord =
	| UserRecord
	| ToolResultRecord
	| AssistantRecord
	| ProgressRecord
	| SystemRecord;

export type ClaudeSessionRecord =
	| UserRecord
	| ToolResultRecord
	| AssistantRecord
	| ProgressRecord
	| SystemRecord
	| SummaryRecord
	| CustomTitleRecord
	| LastPromptRecord
	| AgentNameRecord
	| QueueOperationRecord
	| FileHistorySnapshotRecord;

export function isThreadRecord(record: ClaudeSessionRecord): record is ThreadRecord {
	return (
		record.type === 'user' ||
		record.type === 'assistant' ||
		record.type === 'progress' ||
		record.type === 'system'
	);
}

/** Narrows `type: "user"` records to real human/API user turns, excluding tool-result wrappers. */
export function isUserRecord(record: ClaudeSessionRecord): record is UserRecord {
	return record.type === 'user' && 'recordKind' in record && record.recordKind === 'user';
}

/** Narrows `type: "user"` records to tool-result carriers derived from assistant tool calls. */
export function isToolResultRecord(record: ClaudeSessionRecord): record is ToolResultRecord {
	return record.type === 'user' && 'recordKind' in record && record.recordKind === 'tool_result';
}

/** Narrows to the raw API-level `user` envelope before distinguishing user vs tool_result semantics. */
export function isApiUserRecord(
	record: ClaudeSessionRecord
): record is UserRecord | ToolResultRecord {
	return record.type === 'user';
}

/** Narrows to assistant turns that may contain text, thinking, tools, and token usage metadata. */
export function isAssistantRecord(record: ClaudeSessionRecord): record is AssistantRecord {
	return record.type === 'assistant';
}

export function extractTextFromMessageContent(content: ClaudeMessageContent | undefined): string {
	if (typeof content === 'string') return content;
	if (!Array.isArray(content)) return '';

	return content
		.filter((block): block is TextBlock => block.type === 'text' && typeof block.text === 'string')
		.map((block) => block.text)
		.join('');
}

/**
 * Parses raw `type: "user"` JSON into either a user turn or a tool-result carrier.
 * The `isMeta` and `promptId` checks intentionally hide Claude-injected plumbing
 * such as skill expansion prompts, plan-mode exit messages, and transcript-only
 * tool result wrappers while still letting pasted image-only records through.
 */
function parseUserRecord(record: JsonObject): UserRecord | ToolResultRecord | null {
	const base = parseThreadRecordBase(record);
	const message = parseUserMessage(record.message);
	if (!base || !message) return null;

	const shared = {
		...base,
		type: 'user' as const,
		message,
		promptId: asString(record.promptId),
		permissionMode: asString(record.permissionMode),
		isMeta: asBoolean(record.isMeta),
		isCompactSummary: asBoolean(record.isCompactSummary),
		isVisibleInTranscriptOnly: asBoolean(record.isVisibleInTranscriptOnly)
	};

	const sourceToolUseID = asString(record.sourceToolUseID);
	if (sourceToolUseID) {
		return {
			...shared,
			recordKind: 'tool_result',
			sourceToolUseID,
			sourceToolAssistantUUID: asString(record.sourceToolAssistantUUID)
		};
	}

	// isMeta marks system-injected user records that aren't direct human input.
	// Claude Code sets isMeta on: skill expansions (the full prompt text behind
	// /commit, /simplify, etc.), local-command caveats (XML session preambles),
	// plan mode exit signals ("Continue from where you left off."), and
	// user-submitted images (screenshots pasted into the CLI).
	//
	// isMeta is NOT part of the SDK's public types — getSessionMessages() hides
	// all isMeta records. For the Inspector, we let through image-only records
	// since they're user-submitted content. Everything else is internal plumbing:
	// skill expansions already show as "Launching skill: X" via their Skill
	// tool_use block, plan exits are represented by the ExitPlanMode tool call,
	// and local-command caveats are session infrastructure.
	if (shared.isMeta) {
		const hasImageContent =
			Array.isArray(message.content) &&
			message.content.length > 0 &&
			message.content.every((block) => block.type === 'image');
		if (!hasImageContent) {
			return { ...shared, recordKind: 'tool_result' };
		}
	}

	if (
		Array.isArray(message.content) &&
		message.content.length > 0 &&
		message.content.every((block) => block.type === 'tool_result')
	) {
		return { ...shared, recordKind: 'tool_result' };
	}

	// Records without promptId were not initiated by a human user
	// (e.g. agent/subagent prompts, other system injections)
	if (!shared.promptId) {
		return { ...shared, recordKind: 'tool_result' };
	}

	return { ...shared, recordKind: 'user' };
}

function parseAssistantRecord(record: JsonObject): AssistantRecord | null {
	const base = parseThreadRecordBase(record);
	const message = parseAssistantMessage(record.message);
	if (!base || !message) return null;

	return {
		...base,
		type: 'assistant',
		message,
		requestId: asString(record.requestId),
		isApiErrorMessage: asBoolean(record.isApiErrorMessage),
		apiError: record.apiError,
		error: record.error
	};
}

function parseProgressRecord(record: JsonObject): ProgressRecord | null {
	const base = parseThreadRecordBase(record);
	if (!base) return null;

	return {
		...base,
		type: 'progress',
		data: asObject(record.data) ?? undefined
	};
}

function parseSystemRecord(record: JsonObject): SystemRecord | null {
	const base = parseThreadRecordBase(record);
	if (!base) return null;

	return {
		...base,
		type: 'system',
		subtype: asString(record.subtype),
		content: asString(record.content),
		data: asObject(record.data) ?? undefined,
		durationMs: asNumber(record.durationMs),
		logicalParentUuid: asString(record.logicalParentUuid),
		compactMetadata: asObject(record.compactMetadata) ?? undefined
	};
}

function parseSummaryRecord(record: JsonObject): SummaryRecord {
	return {
		...parseMetadataRecordBase(record, 'summary'),
		type: 'summary',
		summary: asString(record.summary) ?? '',
		leafUuid: asString(record.leafUuid)
	};
}

function parseCustomTitleRecord(record: JsonObject): CustomTitleRecord {
	return {
		...parseMetadataRecordBase(record, 'custom-title'),
		type: 'custom-title',
		customTitle: asString(record.customTitle) ?? ''
	};
}

function parseLastPromptRecord(record: JsonObject): LastPromptRecord {
	return {
		...parseMetadataRecordBase(record, 'last-prompt'),
		type: 'last-prompt',
		lastPrompt: asString(record.lastPrompt) ?? ''
	};
}

function parseAgentNameRecord(record: JsonObject): AgentNameRecord {
	return {
		...parseMetadataRecordBase(record, 'agent-name'),
		type: 'agent-name',
		agentName: asString(record.agentName) ?? ''
	};
}

function parseQueueOperationRecord(record: JsonObject): QueueOperationRecord {
	return {
		...parseMetadataRecordBase(record, 'queue-operation'),
		type: 'queue-operation',
		operation: asString(record.operation),
		content: record.content
	};
}

function parseFileHistorySnapshotRecord(record: JsonObject): FileHistorySnapshotRecord {
	return {
		...parseMetadataRecordBase(record, 'file-history-snapshot'),
		type: 'file-history-snapshot',
		messageId: asString(record.messageId),
		isSnapshotUpdate: asBoolean(record.isSnapshotUpdate),
		snapshot: asObject(record.snapshot) ?? undefined
	};
}

const recordParsers: Record<string, (record: JsonObject) => ClaudeSessionRecord | null> = {
	user: parseUserRecord,
	assistant: parseAssistantRecord,
	progress: parseProgressRecord,
	system: parseSystemRecord,
	summary: parseSummaryRecord,
	'custom-title': parseCustomTitleRecord,
	'last-prompt': parseLastPromptRecord,
	'agent-name': parseAgentNameRecord,
	'queue-operation': parseQueueOperationRecord,
	'file-history-snapshot': parseFileHistorySnapshotRecord
};

export function parseSessionRecordValue(value: unknown): ClaudeSessionRecord | null {
	const record = asObject(value);
	if (!record) return null;

	const type = asString(record.type);
	if (!type) return null;

	const parser = recordParsers[type];
	return parser ? parser(record) : null;
}

function parseThreadRecordBase(record: JsonObject): Omit<ThreadRecordBase, 'type'> | null {
	const uuid = asString(record.uuid);
	const sessionId = asString(record.sessionId);
	const timestamp = asString(record.timestamp);
	if (!uuid || !sessionId || !timestamp) return null;

	return {
		uuid,
		parentUuid: asNullableString(record.parentUuid) ?? null,
		sessionId,
		timestamp,
		cwd: asString(record.cwd),
		gitBranch: asString(record.gitBranch),
		version: asString(record.version),
		isSidechain: asBoolean(record.isSidechain),
		userType: asString(record.userType),
		agentId: asString(record.agentId),
		slug: asString(record.slug),
		teamName: asString(record.teamName)
	};
}

function parseMetadataRecordBase(
	record: JsonObject,
	type: Exclude<SessionRecordType, ThreadRecord['type']>
): MetadataRecordBase {
	return {
		type,
		sessionId: asString(record.sessionId),
		timestamp: asString(record.timestamp),
		cwd: asString(record.cwd),
		gitBranch: asString(record.gitBranch),
		version: asString(record.version)
	};
}

function parseUserMessage(value: unknown): UserMessage | null {
	const message = asObject(value);
	if (!message) return null;

	return {
		role: 'user',
		content: normalizeMessageContent(message.content)
	};
}

function parseAssistantMessage(value: unknown): AssistantMessage | null {
	const message = asObject(value);
	if (!message) return null;

	return {
		role: 'assistant',
		content: normalizeMessageContent(message.content),
		model: asString(message.model),
		id: asString(message.id),
		type: asString(message.type),
		stop_reason: asNullableString(message.stop_reason),
		usage: asObject(message.usage) ?? undefined
	};
}

function normalizeMessageContent(value: unknown): ClaudeMessageContent {
	if (typeof value === 'string') return value;
	if (!Array.isArray(value)) return '';

	return value
		.map((item) => normalizeContentBlock(item))
		.filter((item): item is ClaudeContentBlock => item !== null);
}

export function normalizeContentBlock(value: unknown): ClaudeContentBlock | null {
	const block = asObject(value);
	if (!block) return null;

	const type = asString(block.type);
	if (!type) return null;

	switch (type) {
		case 'text':
			return {
				type,
				text: asString(block.text) ?? ''
			};
		case 'tool_use':
			return {
				type,
				id: asString(block.id) ?? '',
				name: asString(block.name) ?? 'unknown',
				input: asObject(block.input) ?? {},
				caller: asString(block.caller)
			};
		case 'tool_result':
			return {
				type,
				tool_use_id: asString(block.tool_use_id) ?? '',
				content: normalizeToolResultContent(block.content),
				is_error: asBoolean(block.is_error)
			};
		case 'thinking':
			return {
				type,
				thinking: asString(block.thinking) ?? '',
				signature: asString(block.signature)
			};
		case 'image': {
			const source = normalizeImageSource(block.source);
			if (!source) return null;
			return { type, source };
		}
		default:
			return {
				type: 'unknown',
				originalType: type,
				payload: block
			};
	}
}

function normalizeToolResultContent(value: unknown): string | ClaudeContentBlock[] | undefined {
	if (typeof value === 'string') return value;
	if (!Array.isArray(value)) return undefined;

	return value
		.map((item) => normalizeContentBlock(item))
		.filter((item): item is ClaudeContentBlock => item !== null);
}

function normalizeImageSource(value: unknown): ImageBlock['source'] | undefined {
	const source = asObject(value);
	if (!source) return undefined;

	return {
		type: asString(source.type),
		media_type: asString(source.media_type),
		data: asString(source.data)
	};
}

function asObject(value: unknown): JsonObject | null {
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		return null;
	}

	return value as JsonObject;
}

function asString(value: unknown): string | undefined {
	return typeof value === 'string' ? value : undefined;
}

function asNullableString(value: unknown): string | null | undefined {
	if (value === null) return null;
	return asString(value);
}

function asBoolean(value: unknown): boolean | undefined {
	return typeof value === 'boolean' ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
	return typeof value === 'number' ? value : undefined;
}
