import { describe, expect, it } from 'vitest';
import {
	getCyclableModes,
	isPermissionMode,
	PERMISSION_MODE_LABELS,
	PERMISSION_MODES
} from './permission-modes.js';

describe('shared/permission-modes', () => {
	it('recognizes valid permission modes and rejects invalid values', () => {
		expect(isPermissionMode('default')).toBe(true);
		expect(isPermissionMode('dontAsk')).toBe(true);
		expect(isPermissionMode('unknown')).toBe(false);
		expect(isPermissionMode(null)).toBe(false);
	});

	it('returns cyclable modes with or without bypass permissions', () => {
		expect(getCyclableModes(true)).toEqual(PERMISSION_MODES);
		expect(getCyclableModes(false)).toEqual(
			PERMISSION_MODES.filter((mode) => mode !== 'bypassPermissions')
		);
	});

	it('exposes readable labels for each permission mode', () => {
		expect(PERMISSION_MODE_LABELS.default).toBe('Default');
		expect(PERMISSION_MODE_LABELS.dontAsk).toBe("Don't Ask");
	});
});
