import type { SDKAssistantMessageError, SDKResultMessage } from '@anthropic-ai/claude-agent-sdk';

export type SessionErrorCategory =
	| 'transient'
	| 'authentication'
	| 'billing'
	| 'context_limit'
	| 'action'
	| 'network'
	| 'rate_limit'
	| 'unknown';

export interface SessionErrorInfo {
	message: string;
	category: SessionErrorCategory;
	recoverable: boolean;
}

export function createSessionError(
	message: string,
	category: SessionErrorCategory = 'unknown',
	recoverable = true
): SessionErrorInfo {
	return { message, category, recoverable };
}

export function classifyAssistantSessionError(
	error: SDKAssistantMessageError,
	message?: string
): SessionErrorInfo {
	switch (error) {
		case 'authentication_failed':
			return createSessionError(
				message ?? 'Authentication failed. Configure your API key in Settings to continue.',
				'authentication',
				false
			);
		case 'billing_error':
			return createSessionError(
				message ?? 'Billing error. Update billing or API key settings to continue.',
				'billing',
				false
			);
		case 'rate_limit':
			return createSessionError(
				message ?? 'Rate limited by Claude. Wait a moment and retry.',
				'rate_limit',
				true
			);
		default:
			return createSessionError(message ?? `Assistant error: ${error}`, 'transient', true);
	}
}

export function classifyResultSessionError(
	subtype: SDKResultMessage['subtype'],
	message?: string
): SessionErrorInfo {
	switch (subtype) {
		case 'error_max_turns':
			return createSessionError(
				message ??
					'This session hit the context limit. Start a new session in this project to continue.',
				'context_limit',
				false
			);
		case 'error_max_budget_usd':
			return createSessionError(
				message ?? 'This session hit its configured budget limit.',
				'billing',
				false
			);
		default:
			return createSessionError(
				message ?? 'Claude hit an execution error. Retry the last prompt to continue.',
				'transient',
				true
			);
	}
}

export function classifyRuntimeSessionError(message: string): SessionErrorInfo {
	const normalized = message.toLowerCase();

	if (
		normalized.includes('authentication_failed') ||
		normalized.includes('authentication failed') ||
		normalized.includes('api key')
	) {
		return createSessionError(message, 'authentication', false);
	}

	if (
		normalized.includes('billing_error') ||
		normalized.includes('billing error') ||
		normalized.includes('out of credits')
	) {
		return createSessionError(message, 'billing', false);
	}

	if (
		normalized.includes('error_max_turns') ||
		normalized.includes('context window') ||
		normalized.includes('context length') ||
		normalized.includes('maximum turns') ||
		normalized.includes('max turns') ||
		normalized.includes('prompt is too long') ||
		normalized.includes('too many tokens')
	) {
		return createSessionError(message, 'context_limit', false);
	}

	if (normalized.includes('rate limit')) {
		return createSessionError(message, 'rate_limit', true);
	}

	return createSessionError(message, 'transient', true);
}
