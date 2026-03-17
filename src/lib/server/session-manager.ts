import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { open, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import {
	query,
	getSessionInfo,
	type PermissionResult,
	type Query,
	type SDKAssistantMessage,
	type SDKMessage,
	type SDKResultMessage,
	type SDKUserMessage,
	type PermissionMode
} from '@anthropic-ai/claude-agent-sdk';
import {
	HTTP_BAD_REQUEST,
	HTTP_NOT_FOUND,
	HTTP_CONFLICT,
	MS_PER_SECOND,
	MS_PER_MINUTE,
	SECONDS_PER_MINUTE
} from '$lib/constants.js';
import type {
	ActiveSessionState,
	ActiveSessionSummary,
	AskUserQuestionItem,
	AskUserQuestionRequest,
	ClientEvent,
	InProgressTurnSnapshot,
	PermissionRequest,
	PermissionResponse,
	SessionCost,
	SlashCommand
} from '$lib/shared/active-session-types.js';
import type { ModelOption } from '$lib/shared/models.js';
import { FALLBACK_MODELS } from '$lib/shared/models.js';
import type { ContentBlock, ThreadMessage, ToolCall } from '$lib/types.js';
import { getErrorMessage } from '$lib/utils.js';
import {
	cleanupOrphanedProcesses as cleanupTrackedProcesses,
	renameActiveSessionProcess,
	recordActiveSessionProcess,
	removeActiveSessionProcess
} from './active-pids.js';
import { getConfig } from './config.js';
import { parseSessionMessages } from './messages.js';
import { getProjectsDir } from './paths.js';
import { normalizeProjectId } from './project-id.js';
import { reconcileProjectNow } from './reconciler.js';
import { findSessionFile } from './session-discovery.js';

/** File-local constants */
const RECONCILE_DEBOUNCE_MS = 5_000;
const MAX_PROMPT_LENGTH = 2048;
const HEARTBEAT_INTERVAL_MS = 15_000;
const REAPER_MULTIPLIER = 5;
const REAPER_INTERVAL_MS = REAPER_MULTIPLIER * MS_PER_MINUTE;
const REAPER_STALE_THRESHOLD_MS = MS_PER_MINUTE;
const SSE_RETRY_MS = 1_000;

/** Debounce reconciliation per project — avoids redundant work on multi-turn sessions */
const pendingReconciles = new Map<string, NodeJS.Timeout>();
function debouncedReconcile(projectId: string, delayMs = RECONCILE_DEBOUNCE_MS): void {
	const existing = pendingReconciles.get(projectId);
	if (existing) clearTimeout(existing);
	pendingReconciles.set(
		projectId,
		setTimeout(() => {
			pendingReconciles.delete(projectId);
			reconcileProjectNow(projectId).catch(() => {});
		}, delayMs)
	);
}

type SessionController = ReadableStreamDefaultController<Uint8Array>;
type SessionSubscriber = {
	controller: SessionController;
	pendingEvents: ClientEvent[];
	replaying: boolean;
};

interface AsyncQueue<T> {
	enqueue: (item: T) => void;
	close: () => void;
	iterable: AsyncIterable<T>;
}

interface PendingPermission {
	request: PermissionRequest;
	resolve: (result: PermissionResult) => void;
	timeout: NodeJS.Timeout;
}

interface PendingQuestion {
	request: AskUserQuestionRequest;
	rawInput: Record<string, unknown>;
	resolve: (result: PermissionResult) => void;
	timeout: NodeJS.Timeout;
}

type SDKSystemSessionMessage = Extract<SDKMessage, { type: 'system' }>;
type SDKStreamEventMessage = Extract<SDKMessage, { type: 'stream_event' }>;
type SDKUserSessionMessage = Extract<SDKMessage, { type: 'user' }>;
type SDKRateLimitMessage = Extract<SDKMessage, { type: 'rate_limit_event' }>;
type SDKToolProgressMessage = Extract<SDKMessage, { type: 'tool_progress' }>;
type SDKPromptSuggestionMessage = Extract<SDKMessage, { type: 'prompt_suggestion' }>;

export interface ActiveSession {
	sessionId: string;
	projectId: string;
	projectPath: string;
	state: ActiveSessionState;
	permissionMode: PermissionMode;
	model: string;
	messageBuffer: ThreadMessage[];
	inProgressTurn: InProgressTurnSnapshot | null;
	subscribers: Set<SessionSubscriber>;
	pendingPermission: PendingPermission | null;
	pendingQuestion: PendingQuestion | null;
	cost: SessionCost;
	createdAt: string;
	lastActivity: string;
	queryObject: Query | null;
	inputQueue: AsyncQueue<SDKUserMessage>;
	queuedContext: string | null;
	queuedContextId: SDKUserMessage['uuid'] | null;
	toolResults: Map<string, { content: string | ContentBlock[]; isError: boolean }>;
	dangerousPermissionsAllowed: boolean;
	lastError: string | null;
	childPid?: number;
}

interface SessionManagerState {
	activeSessions: Map<string, ActiveSession>;
	heartbeatInterval?: NodeJS.Timeout;
	reaperInterval?: NodeJS.Timeout;
	maintenanceStarted: boolean;
}

const globalSessionManager = globalThis as typeof globalThis & {
	__claudeInspectorSessionManager?: SessionManagerState;
};

const managerState =
	globalSessionManager.__claudeInspectorSessionManager ??
	(globalSessionManager.__claudeInspectorSessionManager = {
		activeSessions: new Map<string, ActiveSession>(),
		maintenanceStarted: false
	});

const cachedModels: ModelOption[] = [...FALLBACK_MODELS];

export function getCachedModels(): ModelOption[] {
	return [...cachedModels];
}

let cachedSlashCommands: SlashCommand[] = [];

export function getCachedSlashCommands(): SlashCommand[] {
	return [...cachedSlashCommands];
}

const encoder = new TextEncoder();

export class SessionManagerError extends Error {
	status: number;

	constructor(status: number, message: string) {
		super(message);
		this.status = status;
		this.name = 'SessionManagerError';
	}
}

interface SessionReplaySnapshot {
	sessionId: string;
	state: ActiveSessionState;
	model: string;
	permissionMode: PermissionMode;
	dangerousPermissionsAllowed: boolean;
	lastError: string | null;
	messages: ThreadMessage[];
	inProgress: InProgressTurnSnapshot | null;
	pendingPermission: PermissionRequest | null;
	pendingQuestion: AskUserQuestionRequest | null;
}

interface SessionSubscription {
	snapshot: SessionReplaySnapshot;
	unsubscribe: () => void;
	completeReplay: () => void;
}

function createEmptyCost(): SessionCost {
	return {
		totalUsd: 0,
		inputTokens: 0,
		outputTokens: 0,
		cacheReadTokens: 0,
		cacheWriteTokens: 0,
		modelUsage: {}
	};
}

function createAsyncQueue<T>(): AsyncQueue<T> {
	const pending: T[] = [];
	let resolve: ((value: IteratorResult<T>) => void) | null = null;
	let closed = false;

	return {
		enqueue(item) {
			if (closed) {
				throw new Error('Input queue is closed');
			}

			if (resolve) {
				const currentResolve = resolve;
				resolve = null;
				currentResolve({ value: item, done: false });
				return;
			}

			pending.push(item);
		},
		close() {
			closed = true;
			if (resolve) {
				const currentResolve = resolve;
				resolve = null;
				currentResolve({ value: undefined as T, done: true });
			}
		},
		iterable: {
			[Symbol.asyncIterator]() {
				return {
					next(): Promise<IteratorResult<T>> {
						if (pending.length > 0) {
							return Promise.resolve({ value: pending.shift() as T, done: false });
						}

						if (closed) {
							return Promise.resolve({ value: undefined as T, done: true });
						}

						return new Promise((nextResolve) => {
							resolve = nextResolve;
						});
					}
				};
			}
		}
	};
}

function nowIso(): string {
	return new Date().toISOString();
}

function createUuid(): NonNullable<SDKUserMessage['uuid']> {
	return randomUUID() as NonNullable<SDKUserMessage['uuid']>;
}

function ensureString(value: unknown, message: string): string {
	if (typeof value !== 'string' || value.trim().length === 0) {
		throw new SessionManagerError(HTTP_BAD_REQUEST, message);
	}

	return value.trim();
}

function asRecord(value: unknown): Record<string, unknown> | null {
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		return null;
	}

	return value as Record<string, unknown>;
}

function asString(value: unknown): string | undefined {
	return typeof value === 'string' ? value : undefined;
}

function requireProjectId(projectId: string): string {
	const normalizedProjectId = normalizeProjectId(projectId);
	if (!normalizedProjectId) {
		throw new SessionManagerError(HTTP_BAD_REQUEST, 'Invalid projectId');
	}

	return normalizedProjectId;
}

async function resolveProjectPath(projectId: string): Promise<string> {
	const safeProjectId = requireProjectId(projectId);
	const projectPath = path.join(getProjectsDir(), safeProjectId);
	const projectStat = await stat(projectPath).catch(() => null);

	if (!projectStat?.isDirectory()) {
		throw new SessionManagerError(HTTP_NOT_FOUND, `Project not found: ${safeProjectId}`);
	}

	return projectPath;
}

/**
 * Resolves the real working directory for a project.
 * The SDK needs the actual project path (e.g. /Users/foo/projects/bar),
 * not the JSONL storage path (~/.claude/projects/-Users-foo-projects-bar).
 *
 * For resume: uses the SDK's getSessionInfo to look up the session's cwd.
 * For new sessions: reads cwd from an existing JSONL file in the storage dir.
 * Falls back to the storage path if resolution fails.
 */
async function resolveRealProjectCwd(storagePath: string, sessionId?: string): Promise<string> {
	if (sessionId) {
		const info = await getSessionInfo(sessionId);
		if (info?.cwd) return info.cwd;
	}

	const entries = await readdir(storagePath);
	const jsonl = entries.find((e) => e.endsWith('.jsonl'));
	if (jsonl) {
		const fd = await open(path.join(storagePath, jsonl), 'r');
		try {
			// Read only the first 2 KB — cwd appears in the second line of the JSONL
			const buf = Buffer.alloc(MAX_PROMPT_LENGTH);
			const { bytesRead } = await fd.read(buf, 0, buf.length, 0);
			const head = buf.toString('utf-8', 0, bytesRead);
			const firstNewline = head.indexOf('\n');
			const secondLine = firstNewline >= 0 ? head.slice(firstNewline + 1) : '';
			const secondNewline = secondLine.indexOf('\n');
			const line = secondNewline >= 0 ? secondLine.slice(0, secondNewline) : secondLine;
			const record = JSON.parse(line) as { cwd?: string };
			if (record.cwd) return record.cwd;
		} catch {
			/* ignore parse/read errors */
		} finally {
			await fd.close();
		}
	}

	return storagePath;
}

async function loadSessionHistory(projectId: string, sessionId: string): Promise<ThreadMessage[]> {
	const sessionFile = await findSessionFile(projectId, sessionId);
	if (!sessionFile) {
		throw new SessionManagerError(HTTP_NOT_FOUND, `Session history not found: ${sessionId}`);
	}

	return parseSessionMessages(sessionFile.fullPath, {
		includeSidechain: sessionFile.isSubagent
	});
}

function createUserMessage(
	sessionId: string,
	prompt: string,
	uuid: SDKUserMessage['uuid'] = createUuid()
): SDKUserMessage {
	return {
		type: 'user',
		uuid,
		session_id: sessionId,
		parent_tool_use_id: null,
		message: {
			role: 'user',
			content: prompt
		}
	};
}

function sendEvent(controller: SessionController, event: ClientEvent): void {
	controller.enqueue(encoder.encode(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`));
}

function sendEventToSubscriber(subscriber: SessionSubscriber, event: ClientEvent): boolean {
	try {
		sendEvent(subscriber.controller, event);
		return true;
	} catch {
		return false;
	}
}

function buildReplaySnapshot(session: ActiveSession): SessionReplaySnapshot {
	return {
		sessionId: session.sessionId,
		state: session.state,
		model: session.model,
		permissionMode: session.permissionMode,
		dangerousPermissionsAllowed: session.dangerousPermissionsAllowed,
		lastError: session.lastError,
		messages: structuredClone(session.messageBuffer),
		inProgress: session.inProgressTurn ? structuredClone(session.inProgressTurn) : null,
		pendingPermission: session.pendingPermission
			? structuredClone(session.pendingPermission.request)
			: null,
		pendingQuestion: session.pendingQuestion
			? structuredClone(session.pendingQuestion.request)
			: null
	};
}

function completeReplay(session: ActiveSession, subscriber: SessionSubscriber): void {
	if (!session.subscribers.has(subscriber)) return;

	subscriber.replaying = false;
	const pendingEvents = subscriber.pendingEvents.splice(0);
	for (const event of pendingEvents) {
		if (!sendEventToSubscriber(subscriber, event)) {
			session.subscribers.delete(subscriber);
			return;
		}
	}
}

function broadcast(session: ActiveSession, event: ClientEvent): void {
	if (session.subscribers.size === 0) return;

	for (const subscriber of session.subscribers) {
		if (subscriber.replaying) {
			subscriber.pendingEvents.push(event);
			continue;
		}

		if (!sendEventToSubscriber(subscriber, event)) {
			session.subscribers.delete(subscriber);
		}
	}
}

function touchSession(session: ActiveSession): void {
	session.lastActivity = nowIso();
}

function setSessionState(session: ActiveSession, state: ActiveSessionState, detail?: string): void {
	session.state = state;
	session.lastError = state === 'error' && detail ? detail : null;
	touchSession(session);
	broadcast(session, {
		type: 'state_change',
		state,
		detail
	});
}

function addOrReplaceMessage(session: ActiveSession, message: ThreadMessage): void {
	const existingIndex = session.messageBuffer.findIndex((entry) => entry.uuid === message.uuid);
	if (existingIndex === -1) {
		session.messageBuffer.push(message);
		return;
	}

	session.messageBuffer.splice(existingIndex, 1, message);
}

function updateToolResultInBuffer(
	session: ActiveSession,
	toolId: string,
	result: string | ContentBlock[],
	isError: boolean
): boolean {
	for (let index = session.messageBuffer.length - 1; index >= 0; index -= 1) {
		const message = session.messageBuffer[index];
		if (message.role !== 'assistant') continue;

		const toolCall = message.toolCalls.find((entry) => entry.id === toolId);
		if (!toolCall) continue;

		toolCall.result = result;
		toolCall.isError = isError;
		return true;
	}

	if (session.inProgressTurn) {
		const toolCall = session.inProgressTurn.toolCalls.find((entry) => entry.id === toolId);
		if (toolCall) {
			toolCall.result = result;
			toolCall.isError = isError;
			return true;
		}
	}

	return false;
}

function extractTextParts(content: unknown): string[] {
	if (typeof content === 'string') return [content];
	if (!Array.isArray(content)) return [];

	return content
		.map((block) => asRecord(block))
		.filter((block): block is Record<string, unknown> => block !== null)
		.filter((block) => block.type === 'text' && typeof block.text === 'string')
		.map((block) => block.text as string);
}

function hasOnlyToolResults(content: unknown): boolean {
	return (
		Array.isArray(content) &&
		content.length > 0 &&
		content.every((block) => {
			const candidate = asRecord(block);
			return candidate?.type === 'tool_result';
		})
	);
}

function toSharedContent(content: unknown): string | ContentBlock[] {
	if (typeof content === 'string') return content;
	if (!Array.isArray(content)) return '';
	return content
		.map((block) => toSharedContentBlock(block))
		.filter((block): block is ContentBlock => block !== null);
}

function toSharedContentBlock(block: unknown): ContentBlock | null {
	const candidate = asRecord(block);
	if (!candidate) return null;

	switch (candidate.type) {
		case 'text':
			return {
				type: 'text',
				text: asString(candidate.text)
			};
		case 'tool_use':
			return {
				type: 'tool_use',
				id: asString(candidate.id),
				name: asString(candidate.name),
				input: asRecord(candidate.input) ?? {},
				caller: asString(candidate.caller)
			};
		case 'tool_result':
			return {
				type: 'tool_result',
				tool_use_id: asString(candidate.tool_use_id),
				content:
					typeof candidate.content === 'string' || Array.isArray(candidate.content)
						? toSharedContent(candidate.content)
						: undefined,
				is_error: candidate.is_error === true
			};
		case 'thinking':
			return {
				type: 'thinking',
				thinking: asString(candidate.thinking),
				signature: asString(candidate.signature)
			};
		case 'image': {
			const source = asRecord(candidate.source);
			return {
				type: 'image',
				source: source
					? {
							type: asString(source.type),
							media_type: asString(source.media_type),
							data: asString(source.data)
						}
					: undefined
			};
		}
		default:
			return null;
	}
}

function toThreadMessageFromUserMessage(
	message: SDKUserMessage,
	timestamp: string
): ThreadMessage | null {
	const textContent = extractTextParts(message.message.content).join('').trim();
	const rawContent = toSharedContent(message.message.content);

	if (!textContent && hasOnlyToolResults(message.message.content)) {
		return null;
	}

	return {
		uuid: message.uuid ?? randomUUID(),
		role: 'user',
		timestamp,
		textContent,
		toolCalls: [],
		thinkingBlocks: [],
		rawContent,
		model: undefined
	};
}

/** Extract tool calls from an SDK assistant message's content blocks. */
function extractToolCallsFromContent(
	toolResultMap: Map<string, { content: string | ContentBlock[]; isError: boolean }>,
	content: unknown[]
): ToolCall[] {
	const toolCalls: ToolCall[] = [];
	for (const block of content) {
		const candidate = asRecord(block);
		if (!candidate || candidate.type !== 'tool_use') continue;

		const toolId = asString(candidate.id);
		if (!toolId) continue;

		const priorResult = toolResultMap.get(toolId);
		toolCalls.push({
			id: toolId,
			name: asString(candidate.name) ?? 'unknown',
			input: asRecord(candidate.input) ?? {},
			result: priorResult?.content,
			isError: priorResult?.isError
		});
		if (priorResult) {
			toolResultMap.delete(toolId);
		}
	}
	return toolCalls;
}

/** Extract thinking text from an SDK assistant message's content blocks. */
function extractThinkingTexts(content: unknown[]): string[] {
	const thinkingBlocks: string[] = [];
	for (const block of content) {
		const candidate = asRecord(block);
		if (!candidate || candidate.type !== 'thinking') continue;

		const thinking = asString(candidate.thinking);
		if (thinking) {
			thinkingBlocks.push(thinking);
		}
	}
	return thinkingBlocks;
}

function toThreadMessageFromAssistantMessage(
	session: ActiveSession,
	message: SDKAssistantMessage,
	timestamp: string
): ThreadMessage | null {
	const textParts = extractTextParts(message.message.content);
	const contentBlocks = Array.isArray(message.message.content) ? message.message.content : [];
	const toolCalls = extractToolCallsFromContent(session.toolResults, contentBlocks as unknown[]);
	const thinkingBlocks = extractThinkingTexts(contentBlocks as unknown[]);

	const textContent = textParts.join('').trim();
	if (!textContent && toolCalls.length === 0 && thinkingBlocks.length === 0) {
		return null;
	}

	return {
		uuid: message.uuid,
		role: 'assistant',
		timestamp,
		textContent,
		toolCalls,
		thinkingBlocks,
		rawContent: toSharedContent(message.message.content),
		model: message.message.model
	};
}

function flushInProgressTurn(session: ActiveSession, timestamp: string): void {
	if (!session.inProgressTurn) return;

	const snapshot = session.inProgressTurn;
	if (
		!snapshot.streamingText.trim() &&
		!snapshot.streamingThinking.trim() &&
		snapshot.toolCalls.length === 0
	) {
		session.inProgressTurn = null;
		return;
	}

	addOrReplaceMessage(session, {
		uuid: snapshot.canonicalUuid ?? snapshot.uuid,
		role: 'assistant',
		timestamp,
		textContent: snapshot.streamingText.trim(),
		toolCalls: snapshot.toolCalls.map((toolCall) => ({ ...toolCall })),
		thinkingBlocks: snapshot.streamingThinking ? [snapshot.streamingThinking] : [],
		rawContent: snapshot.streamingText,
		model: snapshot.model
	});
	session.inProgressTurn = null;
}

function ensureInProgressTurn(session: ActiveSession, uuid: string): InProgressTurnSnapshot {
	if (!session.inProgressTurn || session.inProgressTurn.uuid !== uuid) {
		session.inProgressTurn = {
			uuid,
			streamingText: '',
			streamingThinking: '',
			toolCalls: [],
			startedAt: nowIso(),
			model: session.model
		};
	}

	return session.inProgressTurn;
}

function updateCost(session: ActiveSession, message: SDKResultMessage): void {
	session.cost = {
		totalUsd: message.total_cost_usd,
		inputTokens: message.usage.input_tokens,
		outputTokens: message.usage.output_tokens,
		cacheReadTokens: message.usage.cache_read_input_tokens ?? 0,
		cacheWriteTokens: message.usage.cache_creation_input_tokens ?? 0,
		modelUsage: message.modelUsage
	};
}

/** Parse a single question option from raw input, returning null if invalid. */
function parseQuestionOption(
	optionInput: unknown
): { label: string; description?: string; value?: string; preview?: string } | null {
	const option = asRecord(optionInput);
	if (!option) return null;

	const label = asString(option.label);
	if (!label) return null;

	return {
		label,
		description: asString(option.description),
		value: asString(option.value),
		preview: asString(option.preview)
	};
}

function asAskUserQuestionItems(input: Record<string, unknown>): AskUserQuestionItem[] {
	const questions = Array.isArray(input.questions) ? input.questions : [];
	const items: AskUserQuestionItem[] = [];

	for (const entry of questions) {
		const question = asRecord(entry);
		if (!question) continue;

		const questionText = asString(question.question);
		if (!questionText) continue;

		const optionsInput = Array.isArray(question.options) ? question.options : [];
		const options: AskUserQuestionItem['options'] = optionsInput
			.map(parseQuestionOption)
			.filter((parsed): parsed is NonNullable<typeof parsed> => parsed !== null);

		items.push({
			question: questionText,
			header: asString(question.header),
			multiSelect: question.multiSelect === true,
			options
		});
	}

	return items;
}

function normalizeAnswerRecord(answers: unknown): Record<string, string> {
	const candidate = asRecord(answers);
	if (!candidate) {
		throw new SessionManagerError(HTTP_BAD_REQUEST, 'answers must be an object');
	}

	const normalized: Record<string, string> = {};

	for (const [key, value] of Object.entries(candidate)) {
		if (typeof value === 'string') {
			normalized[key] = value;
			continue;
		}

		if (Array.isArray(value) && value.every((entry) => typeof entry === 'string')) {
			normalized[key] = value.join(', ');
			continue;
		}

		throw new SessionManagerError(HTTP_BAD_REQUEST, `Invalid answer for "${key}"`);
	}

	return normalized;
}

function createSession(
	projectId: string,
	projectPath: string,
	sessionId: string,
	permissionMode: PermissionMode,
	model: string
): ActiveSession {
	const timestamp = nowIso();
	return {
		sessionId,
		projectId,
		projectPath,
		state: 'initializing',
		permissionMode,
		model,
		messageBuffer: [],
		inProgressTurn: null,
		subscribers: new Set(),
		pendingPermission: null,
		pendingQuestion: null,
		cost: createEmptyCost(),
		createdAt: timestamp,
		lastActivity: timestamp,
		queryObject: null,
		inputQueue: createAsyncQueue<SDKUserMessage>(),
		queuedContext: null,
		queuedContextId: null,
		toolResults: new Map(),
		dangerousPermissionsAllowed: permissionMode === 'bypassPermissions',
		lastError: null
	};
}

async function createQuery(session: ActiveSession, resumeSessionId?: string): Promise<Query> {
	const queryObject = query({
		prompt: session.inputQueue.iterable,
		options: {
			cwd: session.projectPath,
			model: session.model || undefined,
			permissionMode: session.permissionMode,
			resume: resumeSessionId,
			forkSession: resumeSessionId ? false : undefined,
			sessionId: resumeSessionId ? undefined : session.sessionId,
			persistSession: true,
			promptSuggestions: true,
			includePartialMessages: true,
			tools: {
				type: 'preset',
				preset: 'claude_code'
			},
			settingSources: ['user', 'project', 'local'],
			maxTurns: Number.MAX_SAFE_INTEGER,
			allowDangerouslySkipPermissions:
				session.permissionMode === 'bypassPermissions' ? true : undefined,
			canUseTool: async (toolName, input, options) => {
				if (toolName === 'AskUserQuestion') {
					return handleAskUserQuestion(session, input, options.toolUseID);
				}

				return handlePermissionRequest(session, toolName, input, {
					toolUseID: options.toolUseID,
					blockedPath: options.blockedPath,
					decisionReason: options.decisionReason,
					agentID: options.agentID
				});
			},
			spawnClaudeCodeProcess: (options) => {
				const child = spawn(options.command, options.args, {
					cwd: options.cwd,
					env: options.env,
					signal: options.signal,
					stdio: ['pipe', 'pipe', 'pipe']
				});

				session.childPid = child.pid ?? undefined;
				if (child.pid) {
					void recordActiveSessionProcess(session.sessionId, child.pid);
				}

				child.once('exit', () => {
					void removeActiveSessionProcess(session.sessionId);
				});

				return child;
			}
		}
	});

	// Fire-and-forget: cache supported models from the SDK
	queryObject
		.supportedModels()
		.then((models) => {
			if (Array.isArray(models) && models.length > 0) {
				const sdkModels: ModelOption[] = [
					{ value: '', displayName: 'Default' },
					...models.map((m) => ({
						value: m.value,
						displayName: m.displayName
					}))
				];
				cachedModels.splice(0, cachedModels.length, ...sdkModels);
			}
		})
		.catch(() => {
			/* fallback list remains */
		});

	// Fire-and-forget: cache supported slash commands from the SDK
	queryObject
		.supportedCommands()
		.then((commands) => {
			if (Array.isArray(commands) && commands.length > 0) {
				cachedSlashCommands = commands;
				broadcast(session, { type: 'slash_commands', commands: cachedSlashCommands });
			}
		})
		.catch(() => {
			/* no slash commands available */
		});

	return queryObject;
}

async function handlePermissionRequest(
	session: ActiveSession,
	toolName: string,
	input: Record<string, unknown>,
	options: {
		toolUseID: string;
		blockedPath?: string;
		decisionReason?: string;
		agentID?: string;
	}
): Promise<PermissionResult> {
	if (session.pendingPermission) {
		const supersededRequest = session.pendingPermission.request;
		clearTimeout(session.pendingPermission.timeout);
		session.pendingPermission.resolve({
			behavior: 'deny',
			message: 'Permission request was superseded by a newer tool request',
			toolUseID: supersededRequest.id
		});
		session.pendingPermission = null;
		broadcast(session, {
			type: 'permission_resolved',
			toolUseId: supersededRequest.id,
			behavior: 'deny'
		});
	}

	const request: PermissionRequest = {
		id: options.toolUseID,
		toolName,
		input,
		timestamp: nowIso(),
		blockedPath: options.blockedPath,
		decisionReason: options.decisionReason,
		agentId: options.agentID
	};

	const config = await getConfig();
	const timeoutMs = config.permissionTimeoutMinutes * SECONDS_PER_MINUTE * MS_PER_SECOND;

	return new Promise((resolve) => {
		const timeout = setTimeout(() => {
			if (session.pendingPermission?.request.id !== request.id) {
				return;
			}

			session.pendingPermission = null;
			resolve({
				behavior: 'deny',
				message: 'Auto-denied: no active UI session',
				toolUseID: request.id
			});
			broadcast(session, {
				type: 'permission_resolved',
				toolUseId: request.id,
				behavior: 'deny'
			});
			setSessionState(session, 'running', 'permission_timeout');
		}, timeoutMs);

		session.pendingPermission = {
			request,
			resolve,
			timeout
		};

		setSessionState(session, 'awaiting_permission');
		broadcast(session, {
			type: 'permission_request',
			request
		});
	});
}

async function handleAskUserQuestion(
	session: ActiveSession,
	input: Record<string, unknown>,
	toolUseId: string
): Promise<PermissionResult> {
	if (session.pendingQuestion) {
		clearTimeout(session.pendingQuestion.timeout);
		session.pendingQuestion.resolve({
			behavior: 'deny',
			message: 'Question was superseded by a newer AskUserQuestion request',
			toolUseID: session.pendingQuestion.request.id
		});
		session.pendingQuestion = null;
	}

	const request: AskUserQuestionRequest = {
		id: toolUseId,
		questions: asAskUserQuestionItems(input),
		timestamp: nowIso()
	};
	const config = await getConfig();
	const timeoutMs = config.permissionTimeoutMinutes * SECONDS_PER_MINUTE * MS_PER_SECOND;

	return new Promise((resolve) => {
		const timeout = setTimeout(() => {
			if (session.pendingQuestion?.request.id !== request.id) {
				return;
			}

			session.pendingQuestion = null;
			resolve({
				behavior: 'deny',
				message: 'Auto-denied: no active UI session',
				toolUseID: request.id
			});
			broadcast(session, {
				type: 'error',
				message: 'AskUserQuestion timed out waiting for UI input',
				recoverable: true
			});
			setSessionState(session, 'running', 'question_timeout');
		}, timeoutMs);

		session.pendingQuestion = {
			request,
			rawInput: input,
			resolve,
			timeout
		};

		setSessionState(session, 'awaiting_input');
		broadcast(session, {
			type: 'ask_user_question',
			request
		});
	});
}

function handleSystemMessage(session: ActiveSession, message: SDKSystemSessionMessage): void {
	if (message.subtype === 'init') {
		if (message.session_id !== session.sessionId) {
			const previousSessionId = session.sessionId;
			session.sessionId = message.session_id;
			managerState.activeSessions.set(session.sessionId, session);
			managerState.activeSessions.delete(previousSessionId);
			void renameActiveSessionProcess(previousSessionId, session.sessionId);
		}

		session.model = message.model;
		session.permissionMode = message.permissionMode;
		setSessionState(session, 'running');
		broadcast(session, {
			type: 'init',
			sessionId: session.sessionId,
			state: session.state,
			model: session.model,
			permissionMode: session.permissionMode,
			dangerousPermissionsAllowed: session.dangerousPermissionsAllowed,
			error: session.lastError
		});
		return;
	}

	if (message.subtype === 'status') {
		if (message.permissionMode && message.permissionMode !== session.permissionMode) {
			session.permissionMode = message.permissionMode;
			broadcast(session, { type: 'config_change', permissionMode: session.permissionMode });
		}

		if (message.status === 'compacting') {
			setSessionState(session, 'compacting');
		} else if (session.state === 'compacting') {
			setSessionState(session, 'running');
		}
		return;
	}

	if (message.subtype === 'compact_boundary') {
		broadcast(session, {
			type: 'compact_boundary',
			trigger: message.compact_metadata.trigger
		});
		setSessionState(session, 'running');
	}
}

/** Resolve the canonical turn UUID — prefer the in-progress turn's UUID over the message's. */
function turnUuid(session: ActiveSession, messageUuid: string): string {
	return session.inProgressTurn?.uuid ?? messageUuid;
}

function handleStreamEventMessage(session: ActiveSession, message: SDKStreamEventMessage): void {
	const event = asRecord(message.event);
	if (event?.type !== 'content_block_delta') {
		return;
	}

	const delta = asRecord(event.delta);
	if (!delta) return;

	const snapshot = ensureInProgressTurn(session, turnUuid(session, message.uuid));

	if (delta.type === 'text_delta') {
		const text = asString(delta.text);
		if (!text) return;

		snapshot.streamingText += text;
		broadcast(session, {
			type: 'assistant_text_delta',
			uuid: snapshot.uuid,
			delta: text
		});
		return;
	}

	if (delta.type === 'thinking_delta') {
		const thinking = asString(delta.thinking);
		if (!thinking) return;

		snapshot.streamingThinking += thinking;
		broadcast(session, {
			type: 'assistant_thinking',
			uuid: snapshot.uuid,
			thinking: snapshot.streamingThinking
		});
	}
}

type ClassifiedContentBlock =
	| { type: 'text'; text: string }
	| { type: 'thinking'; thinking: string }
	| { type: 'tool_use'; toolId: string; toolName: string; input: Record<string, unknown> };

/** Classify a raw content block into a typed discriminated object, or null if unrecognised. */
function classifyContentBlock(block: unknown): ClassifiedContentBlock | null {
	const candidate = asRecord(block);
	if (!candidate) return null;

	if (candidate.type === 'text') {
		const text = asString(candidate.text);
		return text ? { type: 'text', text } : null;
	}

	if (candidate.type === 'thinking') {
		const thinking = asString(candidate.thinking);
		return thinking ? { type: 'thinking', thinking } : null;
	}

	if (candidate.type === 'tool_use') {
		const toolId = asString(candidate.id);
		if (!toolId) return null;
		return {
			type: 'tool_use',
			toolId,
			toolName: asString(candidate.name) ?? 'unknown',
			input: asRecord(candidate.input) ?? {}
		};
	}

	return null;
}

function broadcastAssistantContentBlocks(
	session: ActiveSession,
	message: SDKAssistantMessage
): void {
	if (!Array.isArray(message.message.content)) return;

	const broadcastUuid = turnUuid(session, message.uuid);
	const finalTextBlocks: string[] = [];
	const finalThinkingBlocks: string[] = [];

	for (const block of message.message.content) {
		const classified = classifyContentBlock(block);
		if (!classified) continue;

		switch (classified.type) {
			case 'text':
				finalTextBlocks.push(classified.text);
				break;
			case 'thinking':
				finalThinkingBlocks.push(classified.thinking);
				break;
			case 'tool_use':
				broadcast(session, {
					type: 'tool_use',
					uuid: broadcastUuid,
					toolId: classified.toolId,
					toolName: classified.toolName,
					input: classified.input
				});
				break;
		}
	}

	if (finalTextBlocks.length > 0) {
		broadcast(session, {
			type: 'assistant_text',
			uuid: broadcastUuid,
			text: finalTextBlocks.join(''),
			model: message.message.model
		});
	}

	if (finalThinkingBlocks.length > 0) {
		broadcast(session, {
			type: 'assistant_thinking',
			uuid: broadcastUuid,
			thinking: finalThinkingBlocks.join('\n\n')
		});
	}
}

function syncInProgressTurnFromAssistantMessage(
	session: ActiveSession,
	message: SDKAssistantMessage,
	timestamp: string
): void {
	const snapshot = ensureInProgressTurn(session, turnUuid(session, message.uuid));
	const threadMessage = toThreadMessageFromAssistantMessage(session, message, timestamp);
	if (!threadMessage) {
		return;
	}

	// Store the SDK assistant message UUID — stream events use a different UUID,
	// but the JSONL records this one. Using it in the flushed ThreadMessage ensures
	// messageBuffer UUIDs match JSONL UUIDs, making client-side dedup work on refresh.
	snapshot.canonicalUuid = message.uuid;
	snapshot.model = threadMessage.model ?? snapshot.model;
	snapshot.streamingText = threadMessage.textContent;
	snapshot.streamingThinking = threadMessage.thinkingBlocks.join('\n\n');
	snapshot.toolCalls = threadMessage.toolCalls.map((toolCall) => ({ ...toolCall }));
}

function handleAssistantSdkMessage(
	session: ActiveSession,
	message: SDKAssistantMessage,
	receivedAt: string
): void {
	syncInProgressTurnFromAssistantMessage(session, message, receivedAt);
	broadcastAssistantContentBlocks(session, message);

	if (message.error) {
		broadcast(session, {
			type: 'error',
			message: `Assistant error: ${message.error}`,
			recoverable: true
		});
	}
}

function handleUserSdkMessage(
	session: ActiveSession,
	message: SDKUserSessionMessage,
	receivedAt: string
): void {
	if (Array.isArray(message.message.content)) {
		for (const block of message.message.content) {
			const candidate = asRecord(block);
			if (!candidate || candidate.type !== 'tool_result') continue;

			const toolId = asString(candidate.tool_use_id);
			if (!toolId) continue;

			const result = toSharedContent(candidate.content);
			const isError = candidate.is_error === true;
			const attachedToTurn = updateToolResultInBuffer(session, toolId, result, isError);
			if (!attachedToTurn) {
				session.toolResults.set(toolId, { content: result, isError });
			} else {
				session.toolResults.delete(toolId);
			}
			broadcast(session, {
				type: 'tool_result',
				toolId,
				result,
				isError
			});
		}
	}

	const threadMessage = toThreadMessageFromUserMessage(message, receivedAt);
	if (!threadMessage) return;

	addOrReplaceMessage(session, threadMessage);
	broadcast(session, {
		type: 'user',
		message: threadMessage
	});
}

function handleResultSdkMessage(
	session: ActiveSession,
	message: SDKResultMessage,
	receivedAt: string
): void {
	flushInProgressTurn(session, receivedAt);
	updateCost(session, message);
	broadcast(session, {
		type: 'cost_update',
		cost: session.cost
	});
	broadcast(session, {
		type: 'result',
		subtype: message.subtype,
		result: 'result' in message ? message.result : undefined,
		errors: 'errors' in message ? message.errors : undefined,
		totalCostUsd: message.total_cost_usd,
		numTurns: message.num_turns,
		durationMs: message.duration_ms
	});

	if (session.queuedContext) {
		const queuedNote = session.queuedContext;
		const noteId = session.queuedContextId ?? createUuid();

		session.queuedContext = null;
		session.queuedContextId = null;

		broadcast(session, {
			type: 'queued_note_sent',
			noteId,
			note: queuedNote
		});
		setSessionState(session, 'running', 'queued_note');
		session.inputQueue.enqueue(createUserMessage(session.sessionId, queuedNote, noteId));
		return;
	}

	setSessionState(session, 'idle');

	debouncedReconcile(session.projectId);
}

function handleRateLimitSdkMessage(session: ActiveSession, message: SDKRateLimitMessage): void {
	broadcast(session, {
		type: 'rate_limit',
		status: message.rate_limit_info.status,
		resetsAt: message.rate_limit_info.resetsAt,
		utilization: message.rate_limit_info.utilization,
		overageStatus: message.rate_limit_info.overageStatus
	});

	if (message.rate_limit_info.status === 'rejected') {
		setSessionState(session, 'rate_limited');
	}
}

function handleToolProgressSdkMessage(
	session: ActiveSession,
	message: SDKToolProgressMessage
): void {
	broadcast(session, {
		type: 'tool_progress',
		toolUseId: message.tool_use_id,
		toolName: message.tool_name,
		elapsedSeconds: message.elapsed_time_seconds
	});
}

function handlePromptSuggestionSdkMessage(
	session: ActiveSession,
	message: SDKPromptSuggestionMessage
): void {
	broadcast(session, {
		type: 'prompt_suggestion',
		suggestion: message.suggestion
	});
}

/** Dispatch a single SDK message to the appropriate handler. */
function dispatchSdkMessage(session: ActiveSession, message: SDKMessage, receivedAt: string): void {
	switch (message.type) {
		case 'system':
			handleSystemMessage(session, message);
			break;
		case 'stream_event':
			handleStreamEventMessage(session, message);
			break;
		case 'assistant':
			handleAssistantSdkMessage(session, message, receivedAt);
			break;
		case 'user':
			handleUserSdkMessage(session, message, receivedAt);
			break;
		case 'result':
			handleResultSdkMessage(session, message, receivedAt);
			break;
		case 'rate_limit_event':
			handleRateLimitSdkMessage(session, message);
			break;
		case 'tool_progress':
			handleToolProgressSdkMessage(session, message);
			break;
		case 'prompt_suggestion':
			handlePromptSuggestionSdkMessage(session, message);
			break;
		default:
			break;
	}
}

async function consumeQuery(session: ActiveSession, queryObject: Query): Promise<void> {
	try {
		for await (const message of queryObject) {
			touchSession(session);
			dispatchSdkMessage(session, message, nowIso());
		}

		session.queryObject = null;

		if (
			session.state === 'running' ||
			session.state === 'awaiting_permission' ||
			session.state === 'awaiting_input' ||
			session.state === 'compacting'
		) {
			setSessionState(session, 'error', 'query_ended');
		}
	} catch (error) {
		if (session.state === 'closed') {
			return;
		}

		flushInProgressTurn(session, nowIso());
		session.queryObject = null;
		const errorMessage = getErrorMessage(error);
		setSessionState(session, 'error', errorMessage);
		broadcast(session, {
			type: 'error',
			message: errorMessage,
			recoverable: true
		});
	}
}

function requireSession(sessionId: string): ActiveSession {
	const session = managerState.activeSessions.get(sessionId);
	if (!session) {
		throw new SessionManagerError(HTTP_NOT_FOUND, `Active session not found: ${sessionId}`);
	}

	return session;
}

function ensureMaintenanceLoops(): void {
	if (managerState.maintenanceStarted) return;

	managerState.maintenanceStarted = true;
	managerState.heartbeatInterval = setInterval(() => {
		for (const session of managerState.activeSessions.values()) {
			broadcast(session, {
				type: 'heartbeat'
			});
		}
	}, HEARTBEAT_INTERVAL_MS);

	managerState.reaperInterval = setInterval(() => {
		void reapInactiveSessions();
	}, REAPER_INTERVAL_MS);
}

async function reapInactiveSessions(): Promise<void> {
	const config = await getConfig();
	const cutoff = Date.now() - config.sessionReapMinutes * REAPER_STALE_THRESHOLD_MS;
	const sessionIdsToReap: string[] = [];

	for (const session of managerState.activeSessions.values()) {
		if (session.subscribers.size > 0) continue;
		if (Date.parse(session.lastActivity) >= cutoff) continue;

		sessionIdsToReap.push(session.sessionId);
	}

	await Promise.all(sessionIdsToReap.map((sessionId) => closeSession(sessionId)));
}

ensureMaintenanceLoops();

export async function startNewSession(options: {
	projectId: string;
	prompt: string;
	permissionMode: PermissionMode;
	model: string;
}): Promise<ActiveSession> {
	const prompt = ensureString(options.prompt, 'prompt is required');
	const projectId = requireProjectId(options.projectId);
	const storagePath = await resolveProjectPath(projectId);
	const projectPath = await resolveRealProjectCwd(storagePath);
	const sessionId = randomUUID();

	const session = createSession(
		projectId,
		projectPath,
		sessionId,
		options.permissionMode,
		options.model
	);

	managerState.activeSessions.set(session.sessionId, session);

	try {
		session.queryObject = await createQuery(session);
		void consumeQuery(session, session.queryObject);
		session.inputQueue.enqueue(createUserMessage(session.sessionId, prompt));
	} catch (error) {
		managerState.activeSessions.delete(session.sessionId);
		throw error;
	}

	return session;
}

export async function resumeSession(options: {
	projectId: string;
	prompt: string;
	sessionId: string;
	permissionMode: PermissionMode;
	model: string;
}): Promise<ActiveSession> {
	const prompt = ensureString(options.prompt, 'prompt is required');
	const projectId = requireProjectId(options.projectId);
	const sessionId = ensureString(options.sessionId, 'sessionId is required');
	const existing = managerState.activeSessions.get(sessionId);
	if (existing) {
		if (existing.projectId !== projectId) {
			throw new SessionManagerError(HTTP_CONFLICT, 'Active session belongs to a different project');
		}

		if (existing.permissionMode !== options.permissionMode) {
			await setPermissionMode(existing.sessionId, options.permissionMode);
		}

		if (existing.model !== options.model) {
			await setModel(existing.sessionId, options.model);
		}

		await sendMessage(existing.sessionId, prompt);
		return existing;
	}

	const storagePath = await resolveProjectPath(projectId);
	const projectPath = await resolveRealProjectCwd(storagePath, sessionId);

	const session = createSession(
		projectId,
		projectPath,
		sessionId,
		options.permissionMode,
		options.model
	);

	managerState.activeSessions.set(session.sessionId, session);

	try {
		session.messageBuffer = await loadSessionHistory(projectId, sessionId);
		session.queryObject = await createQuery(session, sessionId);
		void consumeQuery(session, session.queryObject);
		session.inputQueue.enqueue(createUserMessage(session.sessionId, prompt));
	} catch (error) {
		managerState.activeSessions.delete(session.sessionId);
		throw error;
	}

	return session;
}

export function getActiveSession(sessionId: string): ActiveSession | undefined {
	return managerState.activeSessions.get(sessionId);
}

export function getActiveSessions(): ActiveSession[] {
	return [...managerState.activeSessions.values()].sort((left, right) =>
		right.lastActivity.localeCompare(left.lastActivity)
	);
}

export function getActiveSessionSummaries(): ActiveSessionSummary[] {
	return getActiveSessions().map((session) => ({
		sessionId: session.sessionId,
		projectId: session.projectId,
		state: session.state,
		model: session.model,
		permissionMode: session.permissionMode,
		cost: session.cost,
		lastActivity: session.lastActivity
	}));
}

export function subscribe(sessionId: string, controller: SessionController): SessionSubscription {
	const session = requireSession(sessionId);
	const subscriber: SessionSubscriber = {
		controller,
		pendingEvents: [],
		replaying: true
	};

	session.subscribers.add(subscriber);
	const snapshot = buildReplaySnapshot(session);
	touchSession(session);

	return {
		snapshot,
		completeReplay: () => completeReplay(session, subscriber),
		unsubscribe: () => {
			session.subscribers.delete(subscriber);
		}
	};
}

export async function sendMessage(
	sessionId: string,
	prompt: string,
	uuid?: SDKUserMessage['uuid']
): Promise<void> {
	const session = requireSession(sessionId);
	const normalizedPrompt = ensureString(prompt, 'prompt is required');

	if (session.state === 'awaiting_permission' || session.state === 'awaiting_input') {
		throw new SessionManagerError(HTTP_CONFLICT, 'Session is waiting for an in-turn response');
	}

	if (!session.queryObject) {
		throw new SessionManagerError(HTTP_CONFLICT, 'Session is no longer accepting input');
	}

	const messageUuid = uuid ?? createUuid();
	session.inputQueue.enqueue(createUserMessage(session.sessionId, normalizedPrompt, messageUuid));

	const userThreadMessage: ThreadMessage = {
		uuid: String(messageUuid),
		role: 'user',
		timestamp: nowIso(),
		textContent: normalizedPrompt,
		toolCalls: [],
		thinkingBlocks: [],
		rawContent: normalizedPrompt,
		model: undefined
	};
	addOrReplaceMessage(session, userThreadMessage);
	broadcast(session, { type: 'user', message: userThreadMessage });

	touchSession(session);

	if (session.state !== 'running') {
		setSessionState(session, 'running');
	}
}

export async function respondToPermission(
	sessionId: string,
	decision: PermissionResponse
): Promise<{ alreadyResolved: boolean }> {
	const session = requireSession(sessionId);
	const pendingPermission = session.pendingPermission;

	if (!pendingPermission) {
		return { alreadyResolved: true };
	}

	if (pendingPermission.request.id !== decision.toolUseId) {
		throw new SessionManagerError(
			HTTP_CONFLICT,
			'toolUseId does not match the current permission request'
		);
	}

	clearTimeout(pendingPermission.timeout);
	session.pendingPermission = null;

	if (decision.behavior === 'allow') {
		const queuedNote = decision.queuedNote?.trim();
		if (queuedNote) {
			if (session.queuedContext) {
				session.queuedContext = `${session.queuedContext}\n\n${queuedNote}`;
			} else {
				session.queuedContext = queuedNote;
				session.queuedContextId = createUuid();
			}
		}

		pendingPermission.resolve({
			behavior: 'allow',
			updatedInput: { ...pendingPermission.request.input },
			toolUseID: decision.toolUseId
		});
	} else {
		pendingPermission.resolve({
			behavior: 'deny',
			message: ensureString(decision.message, 'message is required'),
			toolUseID: decision.toolUseId
		});
	}

	setSessionState(session, 'running');
	broadcast(session, {
		type: 'permission_resolved',
		toolUseId: decision.toolUseId,
		behavior: decision.behavior
	});

	return { alreadyResolved: false };
}

export async function respondToQuestion(sessionId: string, answers: unknown): Promise<void> {
	const session = requireSession(sessionId);
	const pendingQuestion = session.pendingQuestion;

	if (!pendingQuestion) {
		throw new SessionManagerError(HTTP_CONFLICT, 'There is no pending question for this session');
	}

	session.pendingQuestion = null;
	clearTimeout(pendingQuestion.timeout);
	pendingQuestion.resolve({
		behavior: 'allow',
		updatedInput: {
			...pendingQuestion.rawInput,
			questions: pendingQuestion.rawInput.questions,
			answers: normalizeAnswerRecord(answers)
		},
		toolUseID: pendingQuestion.request.id
	});

	setSessionState(session, 'running');
}

export async function interruptSession(sessionId: string): Promise<void> {
	const session = requireSession(sessionId);
	if (!session.queryObject) {
		throw new SessionManagerError(HTTP_CONFLICT, 'Session is not running');
	}

	await session.queryObject.interrupt();
	touchSession(session);
}

export async function closeSession(sessionId: string): Promise<void> {
	const session = managerState.activeSessions.get(sessionId);
	if (!session) return;

	const projectId = session.projectId;
	managerState.activeSessions.delete(sessionId);

	if (session.pendingPermission) {
		clearTimeout(session.pendingPermission.timeout);
		session.pendingPermission = null;
	}

	if (session.pendingQuestion) {
		clearTimeout(session.pendingQuestion.timeout);
		session.pendingQuestion = null;
	}
	session.inputQueue.close();
	session.queryObject?.close();
	session.queryObject = null;
	session.state = 'closed';
	broadcast(session, {
		type: 'state_change',
		state: 'closed'
	});

	for (const subscriber of session.subscribers) {
		try {
			subscriber.controller.close();
		} catch {
			// Ignore closed controllers.
		}
	}
	session.subscribers.clear();
	await removeActiveSessionProcess(session.sessionId);

	debouncedReconcile(projectId, SSE_RETRY_MS);
}

export async function setPermissionMode(
	sessionId: string,
	permissionMode: PermissionMode
): Promise<void> {
	const session = requireSession(sessionId);
	if (!session.queryObject) {
		throw new SessionManagerError(HTTP_CONFLICT, 'Session is not running');
	}

	await session.queryObject.setPermissionMode(permissionMode);
	session.permissionMode = permissionMode;
	touchSession(session);
	broadcast(session, { type: 'config_change', permissionMode });
}

export async function setModel(sessionId: string, model: string): Promise<void> {
	const session = requireSession(sessionId);
	if (!session.queryObject) {
		throw new SessionManagerError(HTTP_CONFLICT, 'Session is not running');
	}

	const normalizedModel = model.trim();
	await session.queryObject.setModel(normalizedModel || undefined);
	session.model = normalizedModel;
	touchSession(session);
	broadcast(session, { type: 'config_change', model: normalizedModel });
}

export async function shutdownAllSessions(): Promise<void> {
	// Clear pending reconciliation timers before closing sessions
	for (const timer of pendingReconciles.values()) {
		clearTimeout(timer);
	}
	pendingReconciles.clear();

	const sessionIds = [...managerState.activeSessions.keys()];
	await Promise.all(sessionIds.map((sessionId) => closeSession(sessionId)));
}

export async function cleanupOrphanedProcesses(): Promise<number> {
	return cleanupTrackedProcesses();
}
