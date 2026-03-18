/**
 * @module
 * Shared helpers for presenting Claude Code permission modes in the Inspector UI.
 */

import type { PermissionMode } from './active-session-types.js';

/**
 * Ordered list of permission modes exposed by Claude Code.
 * The order is reused by the UI when cycling through mode selectors.
 */
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

const MODES_WITHOUT_BYPASS = PERMISSION_MODES.filter((m) => m !== 'bypassPermissions');

/** Excludes bypass mode when the current session is not allowed to skip permissions entirely. */
export function getCyclableModes(dangerousPermissionsAllowed: boolean): readonly PermissionMode[] {
	return dangerousPermissionsAllowed ? PERMISSION_MODES : MODES_WITHOUT_BYPASS;
}
