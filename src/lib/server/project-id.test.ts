import { describe, expect, it } from 'vitest';
import { normalizeProjectId } from './project-id.js';

describe('server/project-id', () => {
	it('trims and returns valid project ids', () => {
		expect(normalizeProjectId('  my-project  ')).toBe('my-project');
	});

	it('rejects empty ids and traversal-like values', () => {
		expect(normalizeProjectId('   ')).toBeNull();
		expect(normalizeProjectId('../secret')).toBeNull();
	});

	it('rejects ids with .. as a standalone segment between dashes', () => {
		expect(normalizeProjectId('foo-..-bar')).toBeNull();
		expect(normalizeProjectId('..-bar')).toBeNull();
		expect(normalizeProjectId('foo-..')).toBeNull();
	});

	it('allows .. appearing inside a segment name', () => {
		expect(normalizeProjectId('name..withdots')).toBe('name..withdots');
		expect(normalizeProjectId('-foo-bar..baz')).toBe('-foo-bar..baz');
	});

	it('rejects ids containing path separators', () => {
		expect(normalizeProjectId('folder/project')).toBeNull();
	});
});
