import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

const { getConfig, saveConfig, startReconciliation } = vi.hoisted(() => ({
	getConfig: vi.fn(),
	saveConfig: vi.fn(),
	startReconciliation: vi.fn()
}));

vi.mock('$lib/server/config.js', () => ({
	getConfig,
	saveConfig
}));

vi.mock('$lib/server/reconciler.js', () => ({
	startReconciliation
}));

import { actions } from '../src/routes/settings/+page.server.js';

const settingsPagePath =
	'/home/runner/work/claude-inspector/claude-inspector/src/routes/settings/+page.svelte';

describe('settings route regression coverage', () => {
	it('tags invalid API key failures with the apiKey section', async () => {
		const request = new Request('http://localhost/settings?/save', {
			method: 'POST',
			body: new FormData()
		});

		const result = await actions.save({ request } as Parameters<typeof actions.save>[0]);

		expect(result).toEqual({
			status: 400,
			data: {
				error: 'Invalid API key',
				section: 'apiKey'
			}
		});
		expect(saveConfig).not.toHaveBeenCalled();
		expect(startReconciliation).not.toHaveBeenCalled();
	});

	it('only renders the API key error banner for the apiKey section', () => {
		const source = readFileSync(settingsPagePath, 'utf8');

		expect(source).toContain("{#if form?.error && form?.section === 'apiKey'}");
		expect(source).not.toContain("form?.section !== 'session'");
	});
});
