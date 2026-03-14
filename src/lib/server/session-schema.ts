type JsonObject = Record<string, unknown>;

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
	source?: {
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

export interface UserRecord extends ThreadRecordBase {
	type: 'user';
	message: UserMessage;
	promptId?: string;
	permissionMode?: string;
	isMeta?: boolean;
	isCompactSummary?: boolean;
	isVisibleInTranscriptOnly?: boolean;
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

export type ThreadRecord = UserRecord | AssistantRecord | ProgressRecord | SystemRecord;

export type ClaudeSessionRecord =
	| UserRecord
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

export function isUserRecord(record: ClaudeSessionRecord): record is UserRecord {
	return record.type === 'user';
}

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

export function parseSessionRecordValue(value: unknown): ClaudeSessionRecord | null {
	const record = asObject(value);
	if (!record) return null;

	const type = asString(record.type);
	if (!type) return null;

	switch (type) {
		case 'user': {
			const base = parseThreadRecordBase(record);
			const message = parseUserMessage(record.message);
			if (!base || !message) return null;

			return {
				...base,
				type,
				message,
				promptId: asString(record.promptId),
				permissionMode: asString(record.permissionMode),
				isMeta: asBoolean(record.isMeta),
				isCompactSummary: asBoolean(record.isCompactSummary),
				isVisibleInTranscriptOnly: asBoolean(record.isVisibleInTranscriptOnly),
				sourceToolUseID: asString(record.sourceToolUseID),
				sourceToolAssistantUUID: asString(record.sourceToolAssistantUUID)
			};
		}
		case 'assistant': {
			const base = parseThreadRecordBase(record);
			const message = parseAssistantMessage(record.message);
			if (!base || !message) return null;

			return {
				...base,
				type,
				message,
				requestId: asString(record.requestId),
				isApiErrorMessage: asBoolean(record.isApiErrorMessage),
				apiError: record.apiError,
				error: record.error
			};
		}
		case 'progress': {
			const base = parseThreadRecordBase(record);
			if (!base) return null;

			return {
				...base,
				type,
				data: asObject(record.data) ?? undefined
			};
		}
		case 'system': {
			const base = parseThreadRecordBase(record);
			if (!base) return null;

			return {
				...base,
				type,
				subtype: asString(record.subtype),
				content: asString(record.content),
				data: asObject(record.data) ?? undefined,
				durationMs: asNumber(record.durationMs),
				logicalParentUuid: asString(record.logicalParentUuid),
				compactMetadata: asObject(record.compactMetadata) ?? undefined
			};
		}
		case 'summary':
			return {
				...parseMetadataRecordBase(record, type),
				type,
				summary: asString(record.summary) ?? '',
				leafUuid: asString(record.leafUuid)
			};
		case 'custom-title':
			return {
				...parseMetadataRecordBase(record, type),
				type,
				customTitle: asString(record.customTitle) ?? ''
			};
		case 'last-prompt':
			return {
				...parseMetadataRecordBase(record, type),
				type,
				lastPrompt: asString(record.lastPrompt) ?? ''
			};
		case 'agent-name':
			return {
				...parseMetadataRecordBase(record, type),
				type,
				agentName: asString(record.agentName) ?? ''
			};
		case 'queue-operation':
			return {
				...parseMetadataRecordBase(record, type),
				type,
				operation: asString(record.operation),
				content: record.content
			};
		case 'file-history-snapshot':
			return {
				...parseMetadataRecordBase(record, type),
				type,
				messageId: asString(record.messageId),
				isSnapshotUpdate: asBoolean(record.isSnapshotUpdate),
				snapshot: asObject(record.snapshot) ?? undefined
			};
		default:
			return null;
	}
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

function normalizeContentBlock(value: unknown): ClaudeContentBlock | null {
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
		case 'image':
			return {
				type,
				source: normalizeImageSource(block.source)
			};
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
