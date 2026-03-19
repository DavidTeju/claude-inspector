import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import ErrorBanner from './ErrorBanner.svelte';

describe('ErrorBanner', () => {
	it('renders a retry action for recoverable transient errors', () => {
		const { body } = render(ErrorBanner, {
			props: {
				error: {
					message: 'The session ended unexpectedly.',
					category: 'transient',
					recoverable: true
				},
				onRetry: () => {}
			}
		});

		expect(body).toContain('Retry');
	});

	it('renders a settings link for authentication errors', () => {
		const { body } = render(ErrorBanner, {
			props: {
				error: {
					message: 'Authentication failed.',
					category: 'authentication',
					recoverable: false
				}
			}
		});

		expect(body).toContain('Configure API key in Settings');
		expect(body).toContain('href="/settings"');
	});

	it('renders a new-session action for context-limit errors', () => {
		const { body } = render(ErrorBanner, {
			props: {
				error: {
					message: 'This session hit the context limit.',
					category: 'context_limit',
					recoverable: false
				},
				onStartNewSession: () => {}
			}
		});

		expect(body).toContain('Start new session in this project');
	});
});
