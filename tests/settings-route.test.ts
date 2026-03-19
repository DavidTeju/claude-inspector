import type { ComponentProps } from 'svelte';
import { render } from 'svelte/server';
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

const { actions } = await import('../src/routes/settings/+page.server.js');
const { default: SettingsPage } = await import('../src/routes/settings/+page.svelte');

type SettingsPageProps = ComponentProps<typeof SettingsPage>;

const data: SettingsPageProps['data'] = {
	projects: [],
	activeSessions: [],
	models: [],
	hasApiKey: false,
	maskedKey: '',
	defaultPermissionMode: 'default',
	defaultModel: '',
	permissionTimeoutMinutes: 5,
	sessionReapMinutes: 60
} as const;

function sectionHtml(html: string, heading: string, nextHeading: string): string {
	const start = html.indexOf(heading);
	const end = html.indexOf(nextHeading);

	if (start === -1) {
		throw new Error(`Could not find heading: ${heading}`);
	}

	if (end === -1) {
		throw new Error(`Could not find next heading: ${nextHeading}`);
	}

	return html.slice(start, end);
}

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
		const missingSectionForm = {
			error: 'Invalid API key'
		} as unknown as SettingsPageProps['form'];
		const withoutSection = render(SettingsPage, {
			props: {
				data,
				form: missingSectionForm
			}
		}).body;
		const apiKeySection = render(SettingsPage, {
			props: {
				data,
				form: { error: 'Invalid API key', section: 'apiKey' }
			}
		}).body;
		const sessionSection = render(SettingsPage, {
			props: {
				data,
				form: { error: 'Invalid API key', section: 'session' }
			}
		}).body;
		const withoutSectionApiKey = sectionHtml(
			withoutSection,
			'Anthropic API Key',
			'Interactive Sessions'
		);
		const apiKeySectionApiKey = sectionHtml(
			apiKeySection,
			'Anthropic API Key',
			'Interactive Sessions'
		);
		const sessionSectionApiKey = sectionHtml(
			sessionSection,
			'Anthropic API Key',
			'Interactive Sessions'
		);
		const sessionSectionSession = sectionHtml(
			sessionSection,
			'Interactive Sessions',
			'Save Settings'
		);

		expect(withoutSectionApiKey).not.toContain('Invalid API key');
		expect(apiKeySectionApiKey).toContain('Invalid API key');
		expect(sessionSectionApiKey).not.toContain('Invalid API key');
		expect(sessionSectionSession).toContain('Invalid API key');
	});
});
