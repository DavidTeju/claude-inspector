import type { ActiveSessionState } from './active-session-types.js';

export const STATE_COLORS: Record<ActiveSessionState, string> = {
	initializing: 'bg-muted-foreground',
	running: 'bg-primary',
	awaiting_permission: 'bg-warning',
	awaiting_input: 'bg-user',
	rate_limited: 'bg-destructive',
	compacting: 'bg-primary/70',
	idle: 'bg-success',
	error: 'bg-destructive',
	closed: 'bg-muted-foreground/60'
};
