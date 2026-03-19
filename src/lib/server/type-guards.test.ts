import { describe, expect, it } from 'vitest';
import { asObject, asOptionalString } from './type-guards.js';

describe('server/type-guards', () => {
	describe('asObject', () => {
		it('returns plain objects', () => {
			expect(asObject({ ok: true })).toEqual({ ok: true });
		});

		it('rejects arrays, null, and primitives', () => {
			expect(asObject(['nope'])).toBeNull();
			expect(asObject(null)).toBeNull();
			expect(asObject('text')).toBeNull();
		});
	});

	describe('asOptionalString', () => {
		it('returns trimmed strings', () => {
			expect(asOptionalString('  value  ')).toBe('value');
			expect(asOptionalString('  ')).toBe('');
			expect(asOptionalString('')).toBe('');
		});

		it('returns undefined for non-string values', () => {
			expect(asOptionalString(undefined)).toBeUndefined();
			expect(asOptionalString(123)).toBeUndefined();
			expect(asOptionalString(null)).toBeUndefined();
		});
	});
});
