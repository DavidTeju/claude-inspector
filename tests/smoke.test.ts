import { describe, expect, it } from 'vitest';

describe('test infrastructure', () => {
	it('runs a trivial smoke test', () => {
		expect(1 + 1).toBe(2);
	});
});
