import {
	query,
	type PermissionResult,
	type Query,
	type SDKAssistantMessage,
	type SDKMessage,
	type SDKResultMessage,
	type SDKUserMessage,
	type PermissionMode
} from '@anthropic-ai/claude-agent-sdk';
import type {
	ActiveSessionState,
	ActiveSessionSummary,
	AskUserQuestionItem,
	AskUserQuestionRequest,
	ClientEvent,
	InProgressTurnSnapshot,
	PermissionRequest,
	PermissionResponse,
	SessionCost
} from '$lib/shared/active-session-types.js';
import type { ContentBlock, ThreadMessage, ToolCall } from '$lib/types.js';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { getConfig } from './config.js';
import {
	cleanupOrphanedProcesses as cleanupTrackedProcesses,
	renameActiveSessionProcess,
	recordActiveSessionProcess,
	removeActiveSessionProcess
} from './active-pids.js';
import { getProjectsDir } from './paths.js';
import { normalizeProjectId } from './project-id.js';

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
		throw new SessionManagerError(400, message);
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
		throw new SessionManagerError(400, 'Invalid projectId');
	}

	return normalizedProjectId;
}

async function resolveProjectPath(projectId: string): Promise<string> {
	const safeProjectId = requireProjectId(projectId);
	const projectPath = path.join(getProjectsDir(), safeProjectId);
	const projectStat = await stat(projectPath).catch(() => null);

	if (!projectStat?.isDirectory()) {
		throw new SessionManagerError(404, `Project not found: ${safeProjectId}`);
	}

	return projectPath;
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

function toSharedToolResultContent(content: unknown): string | ContentBlock[] {
	if (typeof content === 'string') return content;
	if (!Array.isArray(content)) return '';
	return content
		.map((block) => toSharedContentBlock(block))
		.filter((block): block is ContentBlock => block !== null);
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
						? toSharedToolResultContent(candidate.content)
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
	const textContent = extractTextParts(message.message.content).join('\n').trim();
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

function toThreadMessageFromAssistantMessage(
	session: ActiveSession,
	message: SDKAssistantMessage,
	timestamp: string
): ThreadMessage | null {
	const textParts = extractTextParts(message.message.content);
	const toolCalls: ToolCall[] = [];
	const thinkingBlocks: string[] = [];

	if (Array.isArray(message.message.content)) {
		for (const block of message.message.content) {
			const candidate = asRecord(block);
			if (!candidate) continue;

			if (candidate.type === 'tool_use') {
				const toolId = asString(candidate.id);
				if (!toolId) continue;

				const priorResult = session.toolResults.get(toolId);
				toolCalls.push({
					id: toolId,
					name: asString(candidate.name) ?? 'unknown',
					input: asRecord(candidate.input) ?? {},
					result: priorResult?.content,
					isError: priorResult?.isError
				});
				if (priorResult) {
					session.toolResults.delete(toolId);
				}
				continue;
			}

			if (candidate.type === 'thinking') {
				const thinking = asString(candidate.thinking);
				if (thinking) {
					thinkingBlocks.push(thinking);
				}
			}
		}
	}

	const textContent = textParts.join('\n').trim();
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
		uuid: snapshot.uuid,
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

function asAskUserQuestionItems(input: Record<string, unknown>): AskUserQuestionItem[] {
	const questions = Array.isArray(input.questions) ? input.questions : [];
	const items: AskUserQuestionItem[] = [];

	for (const entry of questions) {
		const question = asRecord(entry);
		if (!question) continue;

		const questionText = asString(question.question);
		if (!questionText) continue;

		const optionsInput = Array.isArray(question.options) ? question.options : [];
		const options: AskUserQuestionItem['options'] = [];

		for (const optionInput of optionsInput) {
			const option = asRecord(optionInput);
			if (!option) continue;

			const label = asString(option.label);
			if (!label) continue;

			options.push({
				label,
				description: asString(option.description),
				value: asString(option.value),
				preview: asString(option.preview)
			});
		}

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
		throw new SessionManagerError(400, 'answers must be an object');
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

		throw new SessionManagerError(400, `Invalid answer for "${key}"`);
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
		toolResults: new Map()
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
	const timeoutMs = config.permissionTimeoutMinutes * 60 * 1000;

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
	const timeoutMs = config.permissionTimeoutMinutes * 60 * 1000;

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
			permissionMode: session.permissionMode
		});
		return;
	}

	if (message.subtype === 'status') {
		if (message.permissionMode) {
			session.permissionMode = message.permissionMode;
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

function handleStreamEventMessage(session: ActiveSession, message: SDKStreamEventMessage): void {
	const event = asRecord(message.event);
	if (event?.type !== 'content_block_delta') {
		return;
	}

	const delta = asRecord(event.delta);
	if (!delta) return;

	const snapshot = ensureInProgressTurn(session, message.uuid);

	if (delta.type === 'text_delta') {
		const text = asString(delta.text);
		if (!text) return;

		snapshot.streamingText += text;
		broadcast(session, {
			type: 'assistant_text_delta',
			uuid: message.uuid,
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
			uuid: message.uuid,
			thinking: snapshot.streamingThinking
		});
	}
}

function broadcastAssistantContentBlocks(
	session: ActiveSession,
	message: SDKAssistantMessage
): void {
	if (!Array.isArray(message.message.content)) return;

	for (const block of message.message.content) {
		const candidate = asRecord(block);
		if (!candidate) continue;

		if (candidate.type === 'text') {
			const text = asString(candidate.text);
			if (text) {
				broadcast(session, {
					type: 'assistant_text',
					uuid: message.uuid,
					text,
					model: message.message.model
				});
			}
			continue;
		}

		if (candidate.type === 'thinking') {
			const thinking = asString(candidate.thinking);
			if (thinking) {
				broadcast(session, {
					type: 'assistant_thinking',
					uuid: message.uuid,
					thinking
				});
			}
			continue;
		}

		if (candidate.type === 'tool_use') {
			const toolId = asString(candidate.id);
			if (!toolId) continue;

			broadcast(session, {
				type: 'tool_use',
				uuid: message.uuid,
				toolId,
				toolName: asString(candidate.name) ?? 'unknown',
				input: asRecord(candidate.input) ?? {}
			});
		}
	}
}

function handleAssistantSdkMessage(
	session: ActiveSession,
	message: SDKAssistantMessage,
	receivedAt: string
): void {
	const threadMessage = toThreadMessageFromAssistantMessage(session, message, receivedAt);
	if (threadMessage) {
		addOrReplaceMessage(session, threadMessage);
	}

	broadcastAssistantContentBlocks(session, message);

	if (session.inProgressTurn?.uuid === message.uuid) {
		session.inProgressTurn = null;
	}

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

			const result = toSharedToolResultContent(candidate.content);
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

async function consumeQuery(session: ActiveSession, queryObject: Query): Promise<void> {
	try {
		for await (const message of queryObject) {
			const receivedAt = nowIso();
			touchSession(session);

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
		setSessionState(session, 'error', 'query_failed');
		broadcast(session, {
			type: 'error',
			message: error instanceof Error ? error.message : 'Unknown session error',
			recoverable: true
		});
	}
}

function requireSession(sessionId: string): ActiveSession {
	const session = managerState.activeSessions.get(sessionId);
	if (!session) {
		throw new SessionManagerError(404, `Active session not found: ${sessionId}`);
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
	}, 15_000);

	managerState.reaperInterval = setInterval(() => {
		void reapInactiveSessions();
	}, 5 * 60_000);
}

async function reapInactiveSessions(): Promise<void> {
	const config = await getConfig();
	const cutoff = Date.now() - config.sessionReapMinutes * 60_000;
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
	const projectPath = await resolveProjectPath(projectId);
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
			throw new SessionManagerError(409, 'Active session belongs to a different project');
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

	const projectPath = await resolveProjectPath(projectId);

	const session = createSession(
		projectId,
		projectPath,
		sessionId,
		options.permissionMode,
		options.model
	);

	managerState.activeSessions.set(session.sessionId, session);

	try {
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

export async function sendMessage(sessionId: string, prompt: string): Promise<void> {
	const session = requireSession(sessionId);
	const normalizedPrompt = ensureString(prompt, 'prompt is required');

	if (session.state === 'awaiting_permission' || session.state === 'awaiting_input') {
		throw new SessionManagerError(409, 'Session is waiting for an in-turn response');
	}

	if (!session.queryObject) {
		throw new SessionManagerError(409, 'Session is no longer accepting input');
	}

	session.inputQueue.enqueue(createUserMessage(session.sessionId, normalizedPrompt));
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
		throw new SessionManagerError(409, 'toolUseId does not match the current permission request');
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
		throw new SessionManagerError(409, 'There is no pending question for this session');
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
		throw new SessionManagerError(409, 'Session is not running');
	}

	await session.queryObject.interrupt();
	touchSession(session);
}

export async function closeSession(sessionId: string): Promise<void> {
	const session = managerState.activeSessions.get(sessionId);
	if (!session) return;

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
}

export async function setPermissionMode(
	sessionId: string,
	permissionMode: PermissionMode
): Promise<void> {
	const session = requireSession(sessionId);
	if (!session.queryObject) {
		throw new SessionManagerError(409, 'Session is not running');
	}

	await session.queryObject.setPermissionMode(permissionMode);
	session.permissionMode = permissionMode;
	touchSession(session);
}

export async function setModel(sessionId: string, model: string): Promise<void> {
	const session = requireSession(sessionId);
	if (!session.queryObject) {
		throw new SessionManagerError(409, 'Session is not running');
	}

	const normalizedModel = model.trim();
	await session.queryObject.setModel(normalizedModel || undefined);
	session.model = normalizedModel;
	touchSession(session);
}

export async function shutdownAllSessions(): Promise<void> {
	const sessionIds = [...managerState.activeSessions.keys()];
	await Promise.all(sessionIds.map((sessionId) => closeSession(sessionId)));
}

export async function cleanupOrphanedProcesses(): Promise<number> {
	return cleanupTrackedProcesses();
}
