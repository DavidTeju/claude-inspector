import type { PermissionMode } from './active-session-types.js';

export const PERMISSION_MODES: readonly PermissionMode[] = [
	'default',
	'acceptEdits',
	'bypassPermissions',
	'plan',
	'dontAsk'
];

export const PERMISSION_MODE_SET = new Set<PermissionMode>(PERMISSION_MODES);

export const PERMISSION_MODE_LABELS: Record<PermissionMode, string> = {
	default: 'Default',
	acceptEdits: 'Accept Edits',
	bypassPermissions: 'Bypass',
	plan: 'Plan',
	dontAsk: "Don't Ask"
};

export function isPermissionMode(value: unknown): value is PermissionMode {
	return typeof value === 'string' && (PERMISSION_MODE_SET as Set<string>).has(value);
}
