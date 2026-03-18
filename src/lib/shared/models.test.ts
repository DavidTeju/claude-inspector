import { describe, expect, it } from 'vitest';
import { FALLBACK_MODELS } from './models.js';

describe('shared/models', () => {
	it('includes the default option and known fallback models', () => {
		expect(FALLBACK_MODELS).toEqual([
			{ value: '', displayName: 'Default' },
			{ value: 'claude-sonnet-4-6', displayName: 'Sonnet 4.6' },
			{ value: 'claude-opus-4-6', displayName: 'Opus 4.6' },
			{ value: 'claude-haiku-4-5-20251001', displayName: 'Haiku 4.5' }
		]);
	});
});
