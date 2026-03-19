import { describe, expect, it } from 'vitest';
import {
	classifyAssistantSessionError,
	classifyResultSessionError,
	classifyRuntimeSessionError
} from './session-errors.js';

describe('session error classification', () => {
	it('classifies authentication failures as non-recoverable settings issues', () => {
		expect(classifyAssistantSessionError('authentication_failed')).toEqual({
			message: 'Authentication failed. Configure your API key in Settings to continue.',
			category: 'authentication',
			recoverable: false
		});
	});

	it('classifies billing failures as non-recoverable settings issues', () => {
		expect(classifyAssistantSessionError('billing_error')).toEqual({
			message: 'Billing error. Update billing or API key settings to continue.',
			category: 'billing',
			recoverable: false
		});
	});

	it('classifies max-turn results as context-limit errors', () => {
		expect(classifyResultSessionError('error_max_turns')).toEqual({
			message:
				'This session hit the context limit. Start a new session in this project to continue.',
			category: 'context_limit',
			recoverable: false
		});
	});

	it('classifies generic runtime failures as transient', () => {
		expect(classifyRuntimeSessionError('Socket hang up')).toEqual({
			message: 'Socket hang up',
			category: 'transient',
			recoverable: true
		});
	});

	it('classifies runtime context overflow hints as non-recoverable context-limit errors', () => {
		expect(classifyRuntimeSessionError('Prompt is too long for the context window')).toEqual({
			message: 'Prompt is too long for the context window',
			category: 'context_limit',
			recoverable: false
		});
	});
});
