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
	rebuildQuery
} from './utils.js';

describe('utils', () => {
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

		it('keeps quoted segments as split terms and drops single-character tokens', () => {
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
			expect(formatDate('2025-03-04T09:05:00')).toBe(
				new Date('2025-03-04T09:05:00').toLocaleDateString('en-US', {
					month: 'short',
					day: 'numeric',
					hour: '2-digit',
					minute: '2-digit'
				})
			);
			expect(formatDate('2024-03-04T09:05:00')).toBe(
				new Date('2024-03-04T09:05:00').toLocaleDateString('en-US', {
					month: 'short',
					day: 'numeric',
					year: 'numeric',
					hour: '2-digit',
					minute: '2-digit'
				})
			);
		});

		it('formats relative times across all display branches', () => {
			expect(formatRelativeDate('')).toBe('Unknown');
			expect(formatRelativeDate('2025-06-15T11:59:45')).toBe('Just now');
			expect(formatRelativeDate('2025-06-15T11:55:00')).toBe('5m ago');
			expect(formatRelativeDate('2025-06-15T09:00:00')).toBe('3h ago');
			expect(formatRelativeDate('2025-06-11T12:00:00')).toBe('4d ago');
			expect(formatRelativeDate('2025-06-05T12:00:00')).toBe(
				new Date('2025-06-05T12:00:00').toLocaleDateString('en-US', {
					month: 'short',
					day: 'numeric'
				})
			);
			expect(formatRelativeDate('2024-12-31T12:00:00')).toBe(
				new Date('2024-12-31T12:00:00').toLocaleDateString('en-US', {
					month: 'short',
					day: 'numeric',
					year: 'numeric'
				})
			);
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

		it('applies terms sequentially for overlapping matches', () => {
			expect(highlightTerms('foobar', 'foo foobar')).toBe(
				'<mark class="search-highlight">foo</mark>bar'
			);
		});
	});

	describe('client filters', () => {
		it('extracts value filters, exact filters, and free text', () => {
			expect(
				parseClientFilters(
					'tool:Read is:error has:cost branch:main mode:raw debug:raw source:raw extra words'
				)
			).toEqual({
				filters: [
					{ prefix: 'tool', value: 'Read', raw: 'tool:Read' },
					{ prefix: 'is', value: 'error', raw: 'is:error' },
					{ prefix: 'has', value: 'cost', raw: 'has:cost' },
					{ prefix: 'branch', value: 'main', raw: 'branch:main' },
					{ prefix: 'mode', value: 'raw', raw: 'mode:raw' },
					{ prefix: 'debug', value: 'raw', raw: 'debug:raw' },
					{ prefix: 'source', value: 'raw', raw: 'source:raw' }
				],
				freeText: 'extra words'
			});
		});

		it('treats incomplete or unknown filters as free text', () => {
			expect(parseClientFilters('tool: branch: unknown:value')).toEqual({
				filters: [],
				freeText: 'tool: branch: unknown:value'
			});
		});

		it('round-trips through rebuildQuery', () => {
			const parsed = parseClientFilters('tool:Read has:tokens free text');
			expect(rebuildQuery(parsed.filters, parsed.freeText)).toBe('tool:Read has:tokens free text');
			expect(rebuildQuery([], '  trimmed text  ')).toBe('trimmed text');
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
