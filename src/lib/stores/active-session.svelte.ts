import type {
	ActiveSessionState,
	ClientEvent,
	PermissionMode,
	PermissionRequest,
	PermissionResponse,
	AskUserQuestionRequest,
	SessionCost
} from '$lib/shared/active-session-types.js';
import type { ThreadMessage, ToolCall } from '$lib/types.js';

export interface ActiveSessionClient {
	readonly sessionId: string;
	readonly state: ActiveSessionState;
	readonly model: string;
	readonly permissionMode: PermissionMode;
	readonly messages: ThreadMessage[];
	readonly streamingText: string;
	readonly streamingThinking: string;
	readonly streamingToolCalls: ToolCall[];
	readonly streamingUuid: string | null;
	readonly streamingModel: string | undefined;
	readonly pendingPermission: PermissionRequest | null;
	readonly pendingQuestion: AskUserQuestionRequest | null;
	readonly cost: SessionCost;
	readonly error: string | null;
	readonly promptSuggestion: string;
	readonly connected: boolean;
	readonly reconnecting: boolean;

	send(prompt: string): Promise<void>;
	respondPermission(response: PermissionResponse): Promise<void>;
	respondQuestion(answers: Record<string, string | string[]>): Promise<void>;
	interrupt(): Promise<void>;
	setPermissionMode(mode: PermissionMode): Promise<void>;
	setModel(model: string): Promise<void>;
	disconnect(): void;
}

const EMPTY_COST: SessionCost = {
	totalUsd: 0,
	inputTokens: 0,
	outputTokens: 0,
	cacheReadTokens: 0,
	cacheWriteTokens: 0,
	modelUsage: {}
};

/** Create a timestamp string without triggering svelte/prefer-svelte-reactivity */
function isoNow(): string {
	return new Date().toISOString();
}

export function createActiveSessionConnection(sessionId: string): ActiveSessionClient {
	// Reactive state
	let state = $state<ActiveSessionState>('initializing');
	let model = $state('');
	let permissionMode = $state<PermissionMode>('default');
	const messages = $state<ThreadMessage[]>([]);
	let streamingText = $state('');
	let streamingThinking = $state('');
	let streamingToolCalls = $state<ToolCall[]>([]);
	let streamingUuid = $state<string | null>(null);
	let streamingModel = $state<string | undefined>(undefined);
	let pendingPermission = $state<PermissionRequest | null>(null);
	let pendingQuestion = $state<AskUserQuestionRequest | null>(null);
	let cost = $state<SessionCost>({ ...EMPTY_COST });
	let error = $state<string | null>(null);
	let promptSuggestion = $state('');
	let connected = $state(false);
	let reconnecting = $state(false);

	// Connection management
	let abortController: AbortController | null = null;
	let heartbeatTimer: ReturnType<typeof setTimeout> | null = null;
	let retryCount = 0;
	let disposed = false;

	const HEARTBEAT_TIMEOUT_MS = 45_000;
	const MAX_RETRIES = 10;
	const BASE_BACKOFF_MS = 1000;
	const MAX_BACKOFF_MS = 30_000;

	// --- Helpers ---

	// eslint-disable-next-line svelte/prefer-svelte-reactivity -- intentionally non-reactive lookup cache
	const knownUuids = new Set<string>();

	function upsertMessage(msg: ThreadMessage) {
		if (knownUuids.has(msg.uuid)) {
			const idx = messages.findIndex((m) => m.uuid === msg.uuid);
			if (idx >= 0) messages[idx] = msg;
		} else {
			knownUuids.add(msg.uuid);
			messages.push(msg);
		}
	}

	function clearStreamingState() {
		streamingUuid = null;
		streamingText = '';
		streamingThinking = '';
		streamingToolCalls = [];
		streamingModel = undefined;
	}

	function flushStreamingToMessage() {
		if (!streamingUuid) return;
		if (!streamingText && !streamingThinking && streamingToolCalls.length === 0) {
			clearStreamingState();
			return;
		}

		const msg: ThreadMessage = {
			uuid: streamingUuid,
			role: 'assistant',
			timestamp: isoNow(),
			textContent: streamingText,
			toolCalls: [...streamingToolCalls],
			thinkingBlocks: streamingThinking ? [streamingThinking] : [],
			rawContent: streamingText,
			model: streamingModel
		};
		upsertMessage(msg);
		clearStreamingState();
	}

	function ensureStreamingTurn(uuid: string) {
		if (uuid !== streamingUuid) {
			flushStreamingToMessage();
			streamingUuid = uuid;
		}
	}

	function resetHeartbeatWatchdog() {
		if (heartbeatTimer) clearTimeout(heartbeatTimer);
		heartbeatTimer = setTimeout(() => {
			abortController?.abort();
		}, HEARTBEAT_TIMEOUT_MS);
	}

	// --- Event sub-handlers (split to keep cyclomatic complexity manageable) ---

	function handleStreamingEvent(event: ClientEvent) {
		switch (event.type) {
			case 'assistant_text_delta':
				ensureStreamingTurn(event.uuid);
				streamingText += event.delta;
				break;
			case 'assistant_thinking':
				ensureStreamingTurn(event.uuid);
				streamingThinking = event.thinking;
				break;
			case 'tool_use':
				ensureStreamingTurn(event.uuid);
				if (!streamingToolCalls.some((t) => t.id === event.toolId)) {
					streamingToolCalls.push({
						id: event.toolId,
						name: event.toolName,
						input: event.input
					});
				}
				break;
			case 'tool_result': {
				const streamingTool = streamingToolCalls.find((t) => t.id === event.toolId);
				if (streamingTool) {
					streamingTool.result = event.result;
					streamingTool.isError = event.isError;
					break;
				}
				for (const msg of messages) {
					const tool = msg.toolCalls.find((t) => t.id === event.toolId);
					if (tool) {
						tool.result = event.result;
						tool.isError = event.isError;
						break;
					}
				}
				break;
			}
			case 'result':
				flushStreamingToMessage();
				break;
		}
	}

	function handleSessionStateEvent(event: ClientEvent) {
		switch (event.type) {
			case 'state_change':
				state = event.state;
				if (state === 'running') {
					pendingPermission = null;
					pendingQuestion = null;
				}
				break;
			case 'cost_update':
				if (
					cost.totalUsd !== event.cost.totalUsd ||
					cost.inputTokens !== event.cost.inputTokens ||
					cost.outputTokens !== event.cost.outputTokens
				) {
					cost = event.cost;
				}
				break;
			case 'rate_limit':
				if (event.status === 'rejected') {
					const resetsIn = event.resetsAt
						? Math.ceil((event.resetsAt - Date.now()) / 1000)
						: undefined;
					error = resetsIn ? `Rate limited. Resets in ${resetsIn}s` : 'Rate limited';
				}
				break;
			case 'error':
				error = event.message;
				if (!event.recoverable) {
					state = 'error';
				}
				break;
			case 'prompt_suggestion':
				promptSuggestion = event.suggestion;
				break;
		}
	}

	function handleInteractionEvent(event: ClientEvent) {
		switch (event.type) {
			case 'permission_request':
				pendingPermission = event.request;
				break;
			case 'permission_resolved':
				if (pendingPermission?.id === event.toolUseId) {
					pendingPermission = null;
				}
				break;
			case 'ask_user_question':
				pendingQuestion = event.request;
				break;
			case 'queued_note_sent':
				upsertMessage({
					uuid: `note-${event.noteId}`,
					role: 'user',
					timestamp: isoNow(),
					textContent: event.note,
					toolCalls: [],
					thinkingBlocks: [],
					rawContent: event.note,
					model: undefined
				});
				break;
		}
	}

	function handleInitEvent(event: ClientEvent) {
		if (event.type !== 'init') return;
		state = event.state;
		model = event.model;
		permissionMode = event.permissionMode;
	}

	function handleMessageEvent(event: ClientEvent) {
		if (event.type !== 'replay_message' && event.type !== 'user') return;
		upsertMessage(event.message);
	}

	function handleReplayInProgress(event: ClientEvent) {
		if (event.type !== 'replay_in_progress') return;
		const snap = event.snapshot;
		streamingUuid = snap.uuid;
		streamingText = snap.streamingText;
		streamingThinking = snap.streamingThinking;
		streamingToolCalls = [...snap.toolCalls];
		streamingModel = snap.model;
	}

	const noop = () => {};

	const eventHandlers: Record<ClientEvent['type'], (event: ClientEvent) => void> = {
		init: handleInitEvent,
		replay_message: handleMessageEvent,
		user: handleMessageEvent,
		replay_in_progress: handleReplayInProgress,
		assistant_text_delta: handleStreamingEvent,
		assistant_thinking: handleStreamingEvent,
		tool_use: handleStreamingEvent,
		tool_result: handleStreamingEvent,
		result: handleStreamingEvent,
		state_change: handleSessionStateEvent,
		cost_update: handleSessionStateEvent,
		rate_limit: handleSessionStateEvent,
		error: handleSessionStateEvent,
		prompt_suggestion: handleSessionStateEvent,
		permission_request: handleInteractionEvent,
		permission_resolved: handleInteractionEvent,
		ask_user_question: handleInteractionEvent,
		queued_note_sent: handleInteractionEvent,
		heartbeat: resetHeartbeatWatchdog,
		assistant_text: noop,
		tool_progress: noop,
		compact_boundary: noop
	};

	function handleEvent(event: ClientEvent) {
		eventHandlers[event.type](event);
	}

	// --- SSE parsing ---

	function parseSSEBuffer(buffer: string): { events: ClientEvent[]; remaining: string } {
		const chunks = buffer.split('\n\n');
		const remaining = chunks.pop() || '';
		const events: ClientEvent[] = [];

		for (const chunk of chunks) {
			if (!chunk.trim()) continue;

			const lines = chunk.split('\n');
			let eventData = '';

			for (const line of lines) {
				if (line.startsWith('data: ')) {
					eventData = line.slice(6);
				}
			}

			if (!eventData) continue;

			try {
				events.push(JSON.parse(eventData) as ClientEvent);
			} catch {
				// Skip malformed events
			}
		}

		return { events, remaining };
	}

	async function readStream(body: ReadableStream<Uint8Array>) {
		const reader = body.getReader();
		const decoder = new TextDecoder();
		let buffer = '';

		while (true) {
			const { done, value } = await reader.read();
			if (done) break;

			buffer += decoder.decode(value, { stream: true });
			const parsed = parseSSEBuffer(buffer);
			buffer = parsed.remaining;

			for (const event of parsed.events) {
				handleEvent(event);
			}
		}
	}

	// --- SSE connection ---

	function cleanupHeartbeat() {
		if (heartbeatTimer) {
			clearTimeout(heartbeatTimer);
			heartbeatTimer = null;
		}
	}

	async function scheduleReconnect() {
		if (disposed || retryCount >= MAX_RETRIES) {
			if (!disposed) {
				error = 'Connection lost after maximum retries';
				state = 'error';
			}
			return;
		}

		reconnecting = true;
		const backoff = Math.min(BASE_BACKOFF_MS * Math.pow(2, retryCount), MAX_BACKOFF_MS);
		retryCount++;
		await new Promise((resolve) => setTimeout(resolve, backoff));
		connect();
	}

	async function connect() {
		if (disposed) return;

		abortController?.abort();
		const controller = new AbortController();
		abortController = controller;

		try {
			const response = await fetch(`/api/session/${sessionId}/stream`, {
				signal: controller.signal
			});

			if (!response.ok || !response.body) {
				if (response.status === 404) {
					state = 'closed';
					connected = false;
					reconnecting = false;
					return;
				}
				throw new Error(`Stream responded ${response.status}`);
			}

			connected = true;
			reconnecting = false;
			retryCount = 0;
			error = null;
			resetHeartbeatWatchdog();

			await readStream(response.body);
		} catch (err: unknown) {
			if (err instanceof Error && err.name === 'AbortError' && disposed) {
				return;
			}
		}

		connected = false;
		cleanupHeartbeat();
		await scheduleReconnect();
	}

	// --- API actions ---

	async function apiPost(path: string, body?: Record<string, unknown>) {
		const response = await fetch(`/api/session/${sessionId}/${path}`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: body ? JSON.stringify(body) : undefined
		});

		if (!response.ok) {
			const data = await response.json().catch(() => ({ error: 'Request failed' }));
			const errorMsg: string = data.error ?? 'Request failed';
			error = errorMsg;
			throw new Error(errorMsg);
		}
	}

	async function send(prompt: string) {
		await apiPost('send', { prompt });
	}

	async function respondPermission(response: PermissionResponse) {
		await apiPost('permission', response);
	}

	async function respondQuestion(answers: Record<string, string | string[]>) {
		await apiPost('question', { answers });
	}

	async function interrupt() {
		await apiPost('interrupt');
	}

	async function setPermissionModeAction(mode: PermissionMode) {
		await apiPost('config', { permissionMode: mode });
	}

	async function setModelAction(newModel: string) {
		await apiPost('config', { model: newModel });
	}

	function disconnect() {
		disposed = true;
		abortController?.abort();
		cleanupHeartbeat();
		connected = false;
	}

	// Start connection
	connect();

	return {
		get sessionId() {
			return sessionId;
		},
		get state() {
			return state;
		},
		get model() {
			return model;
		},
		get permissionMode() {
			return permissionMode;
		},
		get messages() {
			return messages;
		},
		get streamingText() {
			return streamingText;
		},
		get streamingThinking() {
			return streamingThinking;
		},
		get streamingToolCalls() {
			return streamingToolCalls;
		},
		get streamingUuid() {
			return streamingUuid;
		},
		get streamingModel() {
			return streamingModel;
		},
		get pendingPermission() {
			return pendingPermission;
		},
		get pendingQuestion() {
			return pendingQuestion;
		},
		get cost() {
			return cost;
		},
		get error() {
			return error;
		},
		get promptSuggestion() {
			return promptSuggestion;
		},
		get connected() {
			return connected;
		},
		get reconnecting() {
			return reconnecting;
		},

		send,
		respondPermission,
		respondQuestion,
		interrupt,
		setPermissionMode: setPermissionModeAction,
		setModel: setModelAction,
		disconnect
	};
}
