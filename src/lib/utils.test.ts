import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	dirNameToDisplayName,
	escapeHtml,
	formatDate,
	formatRelativeDate,
	formatTime,
	getErrorMessage,
	highlightTerms,
	isDoubleMangledProjectId,
	parseClientFilters,
	parseSearchTerms,
	pluralize,
	rebuildQuery,
	uuid
} from './utils.js';

describe('utils', () => {
	describe('uuid', () => {
		afterEach(() => {
			vi.unstubAllGlobals();
		});

		it('uses crypto.randomUUID when available', () => {
			vi.stubGlobal('crypto', {
				getRandomValues: globalThis.crypto.getRandomValues.bind(globalThis.crypto),
				randomUUID: () => '123e4567-e89b-42d3-a456-426614174000'
			});

			expect(uuid()).toBe('123e4567-e89b-42d3-a456-426614174000');
		});

		it('generates an RFC 4122 v4 UUID when randomUUID is unavailable', () => {
			vi.stubGlobal('crypto', {
				getRandomValues: (bytes: Uint8Array) => {
					bytes.set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
					return bytes;
				}
			});

			expect(uuid()).toBe('00010203-0405-4607-8809-0a0b0c0d0e0f');
		});
	});

	describe('dirNameToDisplayName', () => {
		it('strips a projects prefix and keeps the trailing project name', () => {
			expect(dirNameToDisplayName('-Users-david-projects-myapp')).toBe('myapp');
		});

		it('restores slash-separated paths for user-prefixed names', () => {
			expect(dirNameToDisplayName('Users-david-work-app-src')).toBe('work/app/src');
		});

		it('handles empty and already-readable names', () => {
			expect(dirNameToDisplayName('')).toBe('');
			expect(dirNameToDisplayName('project')).toBe('project');
		});

		it('falls back to replacing dashes with slashes', () => {
			expect(dirNameToDisplayName('some-random-path')).toBe('some/random/path');
		});
	});

	describe('isDoubleMangledProjectId', () => {
		it('detects legacy double-mangled ids', () => {
			expect(isDoubleMangledProjectId('Users--claude-projects--demo')).toBe(true);
		});

		it('rejects normal project ids', () => {
			expect(isDoubleMangledProjectId('Users-demo-project')).toBe(false);
		});
	});

	describe('parseSearchTerms', () => {
		it('normalizes multi-word queries to lowercase terms', () => {
			expect(parseSearchTerms('Hello WORLD search')).toEqual(['hello', 'world', 'search']);
		});

		it('splits on whitespace and drops single-character tokens', () => {
			expect(parseSearchTerms('"Quoted phrase" x go')).toEqual(['"quoted', 'phrase"', 'go']);
		});

		it('returns an empty array for blank input', () => {
			expect(parseSearchTerms('   ')).toEqual([]);
		});
	});

	describe('pluralize', () => {
		it('handles zero, singular, plural, and custom plural forms', () => {
			expect(pluralize(0, 'session')).toBe('0 sessions');
			expect(pluralize(1, 'session')).toBe('1 session');
			expect(pluralize(3, 'session')).toBe('3 sessions');
			expect(pluralize(2, 'person', 'people')).toBe('2 people');
		});
	});

	describe('escapeHtml', () => {
		it('escapes special characters and already-escaped content', () => {
			expect(escapeHtml(`<script>"Tom" & 'Jerry'</script>`)).toBe(
				'&lt;script&gt;&quot;Tom&quot; &amp; &#39;Jerry&#39;&lt;/script&gt;'
			);
			expect(escapeHtml('&lt;safe&gt;')).toBe('&amp;lt;safe&amp;gt;');
		});
	});

	describe('formatTime', () => {
		it('formats midnight and noon using en-US 12-hour time', () => {
			expect(formatTime('2025-01-01T00:00:00')).toBe('12:00 AM');
			expect(formatTime('2025-01-01T12:00:00')).toBe('12:00 PM');
		});
	});

	describe('date formatting', () => {
		beforeEach(() => {
			vi.useFakeTimers();
			vi.setSystemTime(new Date('2025-06-15T12:00:00'));
		});

		afterEach(() => {
			vi.useRealTimers();
		});

		it('formats same-year dates without the year and older dates with the year', () => {
			expect(formatDate('')).toBe('');
			expect(formatDate('2025-03-04T09:05:00')).toBe('Mar 4, 09:05 AM');
			expect(formatDate('2024-03-04T09:05:00')).toBe('Mar 4, 2024, 09:05 AM');
		});

		it('formats relative times across all display branches', () => {
			expect(formatRelativeDate('')).toBe('Unknown');
			expect(formatRelativeDate('2025-06-15T11:59:45')).toBe('Just now');
			expect(formatRelativeDate('2025-06-15T11:55:00')).toBe('5m ago');
			expect(formatRelativeDate('2025-06-15T09:00:00')).toBe('3h ago');
			expect(formatRelativeDate('2025-06-11T12:00:00')).toBe('4d ago');
			expect(formatRelativeDate('2025-06-05T12:00:00')).toBe('Jun 5');
			expect(formatRelativeDate('2024-12-31T12:00:00')).toBe('Dec 31, 2024');
		});
	});

	describe('highlightTerms', () => {
		it('highlights single and repeated matches', () => {
			expect(highlightTerms('Read and read again', 'read')).toBe(
				'<mark class="search-highlight">Read</mark> and <mark class="search-highlight">read</mark> again'
			);
		});

		it('escapes HTML before highlighting and leaves unmatched text escaped', () => {
			expect(highlightTerms('<b>Read</b> & review', 'read')).toBe(
				'&lt;b&gt;<mark class="search-highlight">Read</mark>&lt;/b&gt; &amp; review'
			);
			expect(highlightTerms('<tag>', 'missing')).toBe('&lt;tag&gt;');
		});

		it('applies terms sequentially so earlier terms take precedence', () => {
			expect(highlightTerms('foobar', 'foo foobar')).toBe(
				'<mark class="search-highlight">foo</mark>bar'
			);
		});
	});

	describe('client filters', () => {
		it('extracts value filters, exact filters, and free text', () => {
			expect(parseClientFilters('project:inspector has:error model:opus extra words')).toEqual({
				filters: [
					{ prefix: 'project', value: 'inspector', raw: 'project:inspector', negated: false },
					{ prefix: 'has', value: 'error', raw: 'has:error', negated: false },
					{ prefix: 'model', value: 'opus', raw: 'model:opus', negated: false }
				],
				freeText: 'extra words',
				rawMode: false,
				regexMode: false
			});
		});

		it('separates mode:raw as rawMode flag, not a filter', () => {
			const result = parseClientFilters('mode:raw debug:raw source:raw query');
			expect(result.rawMode).toBe(true);
			expect(result.filters).toEqual([]);
			expect(result.freeText).toBe('query');
		});

		it('separates mode:regex as regexMode flag', () => {
			const result = parseClientFilters('mode:regex query');
			expect(result.regexMode).toBe(true);
			expect(result.filters).toEqual([]);
		});

		it('handles negated filters', () => {
			const result = parseClientFilters('-is:subagent -project:inspector');
			expect(result.filters).toEqual([
				{ prefix: 'is', value: 'subagent', raw: '-is:subagent', negated: true },
				{ prefix: 'project', value: 'inspector', raw: '-project:inspector', negated: true }
			]);
		});

		it('handles quoted phrases as free text', () => {
			const result = parseClientFilters('"error handling" has:error');
			expect(result.filters).toEqual([
				{ prefix: 'has', value: 'error', raw: 'has:error', negated: false }
			]);
			expect(result.freeText).toBe('"error handling"');
		});

		it('handles is:error as backward-compat alias for has:error', () => {
			const result = parseClientFilters('is:error');
			expect(result.filters).toEqual([
				{ prefix: 'has', value: 'error', raw: 'is:error', negated: false }
			]);
		});

		it('handles project: and model: and date: filters', () => {
			const result = parseClientFilters('project:inspector model:opus date:7d');
			expect(result.filters).toEqual([
				{ prefix: 'project', value: 'inspector', raw: 'project:inspector', negated: false },
				{ prefix: 'model', value: 'opus', raw: 'model:opus', negated: false },
				{ prefix: 'date', value: '7d', raw: 'date:7d', negated: false }
			]);
		});

		it('treats incomplete or unknown filters as free text', () => {
			expect(parseClientFilters('project: unknown:value')).toEqual({
				filters: [],
				freeText: 'project: unknown:value',
				rawMode: false,
				regexMode: false
			});
		});

		it('treats removed filters (tool:, branch:) as free text', () => {
			const result = parseClientFilters('tool:Read branch:main query');
			expect(result.filters).toEqual([]);
			expect(result.freeText).toBe('tool:Read branch:main query');
		});

		it('round-trips through rebuildQuery', () => {
			const parsed = parseClientFilters('project:foo has:error free text');
			expect(rebuildQuery(parsed.filters, parsed.freeText)).toBe('project:foo has:error free text');
			expect(rebuildQuery([], '  trimmed text  ')).toBe('trimmed text');
		});

		it('round-trips negated filters through rebuildQuery', () => {
			const parsed = parseClientFilters('-project:foo -is:subagent free text');
			expect(rebuildQuery(parsed.filters, parsed.freeText)).toBe(
				'-project:foo -is:subagent free text'
			);
		});

		it('handles mixed negation, phrases, and filters', () => {
			const result = parseClientFilters('-project:foo "exact phrase" has:error query');
			expect(result.filters).toHaveLength(2);
			expect(result.filters[0]).toEqual({
				prefix: 'project',
				value: 'foo',
				raw: '-project:foo',
				negated: true
			});
			expect(result.filters[1]).toEqual({
				prefix: 'has',
				value: 'error',
				raw: 'has:error',
				negated: false
			});
			expect(result.freeText).toBe('"exact phrase" query');
		});
	});

	describe('getErrorMessage', () => {
		it('extracts messages from Error instances and strings', () => {
			expect(getErrorMessage(new Error('boom'))).toBe('boom');
			expect(getErrorMessage('plain error')).toBe('plain error');
		});

		it('falls back for nullish and unsupported values', () => {
			expect(getErrorMessage(null)).toBe('Unknown error');
			expect(getErrorMessage(undefined)).toBe('Unknown error');
			expect(getErrorMessage({ message: 'not-an-error-instance' })).toBe('Unknown error');
		});
	});
});
