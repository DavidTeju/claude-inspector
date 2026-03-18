import { describe, expect, it } from 'vitest';
import type { ActiveSessionState } from './active-session-types.js';
import { STATE_COLORS } from './state-colors.js';

describe('shared/state-colors', () => {
	it('has a tailwind background color for every active session state', () => {
		const states: ActiveSessionState[] = [
			'initializing',
			'running',
			'awaiting_permission',
			'awaiting_input',
			'rate_limited',
			'compacting',
			'idle',
			'error',
			'closed'
		];

		for (const state of states) {
			expect(STATE_COLORS[state]).toBeDefined();
			expect(STATE_COLORS[state]).toMatch(/^bg-/);
		}
	});
});
