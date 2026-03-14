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
import { SvelteSet } from 'svelte/reactivity';

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

export function createActiveSessionConnection(
	sessionId: string,
	initialMessages?: ThreadMessage[]
): ActiveSessionClient {
	// Reactive state
	let state = $state<ActiveSessionState>('initializing');
	let model = $state('');
	let permissionMode = $state<PermissionMode>('default');
	const messages = $state<ThreadMessage[]>(initialMessages ? [...initialMessages] : []);
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

	const knownUuids = new SvelteSet<string>(initialMessages?.map((m) => m.uuid));

	function upsertMessage(msg: ThreadMessage) {
		if (knownUuids.has(msg.uuid)) {
			const idx = messages.findIndex((m) => m.uuid === msg.uuid);
			if (idx >= 0) messages[idx] = msg;
		} else {
			knownUuids.add(msg.uuid);
			messages.push(msg);
		}
	}

	function addOptimisticUserMessage(prompt: string, uuid: string) {
		upsertMessage({
			uuid,
			role: 'user',
			timestamp: isoNow(),
			textContent: prompt,
			toolCalls: [],
			thinkingBlocks: [],
			rawContent: prompt,
			model: undefined
		});
	}

	function clearStreamingState() {
		if (!streamingUuid) return;
		streamingUuid = null;
		streamingText = '';
		streamingThinking = '';
		streamingToolCalls = [];
		streamingModel = undefined;
	}

	function flushStreamingToMessage() {
		const finalizedText = streamingText.trim();
		const finalizedThinking = streamingThinking.trim();

		if (!streamingUuid) return;
		if (!finalizedText && !finalizedThinking && streamingToolCalls.length === 0) {
			clearStreamingState();
			return;
		}

		const msg: ThreadMessage = {
			uuid: streamingUuid,
			role: 'assistant',
			timestamp: isoNow(),
			textContent: finalizedText,
			toolCalls: [...streamingToolCalls],
			thinkingBlocks: finalizedThinking ? [finalizedThinking] : [],
			rawContent: finalizedText,
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

		if (!streamingModel) {
			streamingModel = model || undefined;
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
			case 'assistant_text':
				ensureStreamingTurn(event.uuid);
				streamingModel = event.model ?? streamingModel;
				streamingText = event.text;
				break;
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
				if (state === event.state) break;
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
					uuid: event.noteId,
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

	function handleConfigChange(event: ClientEvent) {
		if (event.type !== 'config_change') return;
		if (event.model !== undefined) model = event.model;
		if (event.permissionMode !== undefined) permissionMode = event.permissionMode;
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
		assistant_text: handleStreamingEvent,
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
		config_change: handleConfigChange,
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
			const dataLines: string[] = [];

			for (const line of lines) {
				if (line.startsWith('data: ')) {
					dataLines.push(line.slice(6));
				}
			}

			if (dataLines.length === 0) continue;
			const eventData = dataLines.join('\n');

			try {
				const parsed: unknown = JSON.parse(eventData);
				if (parsed && typeof parsed === 'object' && 'type' in parsed) {
					events.push(parsed as ClientEvent);
				}
			} catch (e) {
				if (import.meta.env.DEV) console.warn('[SSE] Malformed event:', chunk, e);
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

	async function connect() {
		while (!disposed && retryCount < MAX_RETRIES) {
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

			// Connection lost — backoff and retry
			connected = false;
			cleanupHeartbeat();
			reconnecting = true;
			const backoff = Math.min(BASE_BACKOFF_MS * Math.pow(2, retryCount), MAX_BACKOFF_MS);
			retryCount++;
			await new Promise((resolve) => setTimeout(resolve, backoff));
		}

		if (!disposed) {
			error = 'Connection lost after maximum retries';
			state = 'error';
		}
	}

	// --- API actions ---

	async function apiPost(path: string, body?: Record<string, unknown>): Promise<boolean> {
		const response = await fetch(`/api/session/${sessionId}/${path}`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: body ? JSON.stringify(body) : undefined
		});

		if (!response.ok) {
			const data = await response.json().catch(() => ({ error: 'Request failed' }));
			error = data.error ?? 'Request failed';
			return false;
		}

		error = null;
		return true;
	}

	async function send(prompt: string) {
		const uuid = globalThis.crypto.randomUUID();
		addOptimisticUserMessage(prompt, uuid);
		await apiPost('send', { prompt, uuid });
	}

	async function respondPermission(response: PermissionResponse) {
		const ok = await apiPost('permission', response);
		if (!ok) return;
		if (pendingPermission?.id === response.toolUseId) {
			pendingPermission = null;
		}
		if (state === 'awaiting_permission') {
			state = 'running';
		}
	}

	async function respondQuestion(answers: Record<string, string | string[]>) {
		const activeQuestionId = pendingQuestion?.id;
		const ok = await apiPost('question', { answers });
		if (!ok) return;
		if (pendingQuestion?.id === activeQuestionId) {
			pendingQuestion = null;
		}
		if (state === 'awaiting_input') {
			state = 'running';
		}
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
