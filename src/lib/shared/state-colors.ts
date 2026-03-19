import type { ActiveSessionState } from './active-session-types.js';

export const STATE_COLORS: Record<ActiveSessionState, string> = {
	initializing: 'bg-base-content/50',
	running: 'bg-primary',
	awaiting_permission: 'bg-warning',
	awaiting_input: 'bg-secondary',
	rate_limited: 'bg-error',
	compacting: 'bg-primary',
	idle: 'bg-success',
	error: 'bg-error',
	closed: 'bg-base-content/30'
};
