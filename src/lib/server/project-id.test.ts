import { describe, expect, it } from 'vitest';
import { normalizeProjectId } from './project-id.js';

describe('server/project-id', () => {
	it('trims and returns valid project ids', () => {
		expect(normalizeProjectId('  my-project  ')).toBe('my-project');
	});

	it('rejects empty ids and traversal-like values', () => {
		expect(normalizeProjectId('   ')).toBeNull();
		expect(normalizeProjectId('../secret')).toBeNull();
		expect(normalizeProjectId('name..withdots')).toBeNull();
	});

	it('rejects ids containing path separators', () => {
		expect(normalizeProjectId('folder/project')).toBeNull();
	});
});
