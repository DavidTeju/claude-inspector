import type { ActiveSessionState } from './active-session-types.js';

export const STATE_COLORS: Record<ActiveSessionState, string> = {
	initializing: 'bg-text-500',
	running: 'bg-accent-400',
	awaiting_permission: 'bg-warning-500',
	awaiting_input: 'bg-user-400',
	rate_limited: 'bg-error-500',
	compacting: 'bg-accent-300',
	idle: 'bg-success-500',
	error: 'bg-error-500',
	closed: 'bg-text-700'
};
