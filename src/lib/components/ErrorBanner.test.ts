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

		expect(body).toContain('Retry last prompt');
		expect(body).toContain('Recoverable Error');
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

		expect(body).toContain('Open Settings');
		expect(body).toContain('href="/settings"');
		expect(body).toContain('Authentication Error');
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

		expect(body).toContain('Start new session');
		expect(body).toContain('Context Limit Reached');
	});

	it('renders category labels for each error type', () => {
		const { body: billingBody } = render(ErrorBanner, {
			props: {
				error: {
					message: 'Billing error.',
					category: 'billing',
					recoverable: false
				}
			}
		});

		expect(billingBody).toContain('Billing Error');

		const { body: rateLimitBody } = render(ErrorBanner, {
			props: {
				error: {
					message: 'Rate limited.',
					category: 'rate_limit',
					recoverable: true
				},
				onRetry: () => {}
			}
		});

		expect(rateLimitBody).toContain('Rate Limited');
		expect(rateLimitBody).toContain('Retry last prompt');
	});

	it('renders retry action for action errors', () => {
		const { body } = render(ErrorBanner, {
			props: {
				error: {
					message: 'Request failed.',
					category: 'action',
					recoverable: true
				},
				onRetry: () => {}
			}
		});

		expect(body).toContain('Retry last prompt');
		expect(body).toContain('Action Failed');
	});
});
