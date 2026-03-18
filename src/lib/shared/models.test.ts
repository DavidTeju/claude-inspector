import { describe, expect, it } from 'vitest';
import { FALLBACK_MODELS } from './models.js';

describe('shared/models', () => {
	it('always includes the default option first', () => {
		expect(FALLBACK_MODELS[0]).toEqual({ value: '', displayName: 'Default' });
	});

	it('only contains entries with display names', () => {
		for (const model of FALLBACK_MODELS) {
			expect(model.displayName).toBeTruthy();
		}
	});
});
