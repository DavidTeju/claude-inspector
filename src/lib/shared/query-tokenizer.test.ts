import { describe, expect, it } from 'vitest';
import { tokenizeQuery } from './query-tokenizer.js';

describe('tokenizeQuery', () => {
	it('returns empty array for blank input', () => {
		expect(tokenizeQuery('')).toEqual([]);
		expect(tokenizeQuery('   ')).toEqual([]);
	});

	it('splits whitespace-delimited words', () => {
		expect(tokenizeQuery('hello world')).toEqual([
			{ raw: 'hello', body: 'hello', negated: false, quoted: false },
			{ raw: 'world', body: 'world', negated: false, quoted: false }
		]);
	});

	it('handles quoted phrases', () => {
		expect(tokenizeQuery('"error handling"')).toEqual([
			{ raw: '"error handling"', body: 'error handling', negated: false, quoted: true }
		]);
	});

	it('handles negated tokens', () => {
		expect(tokenizeQuery('-is:subagent')).toEqual([
			{ raw: '-is:subagent', body: 'is:subagent', negated: true, quoted: false }
		]);
	});

	it('handles negated quoted phrases', () => {
		expect(tokenizeQuery('-"error handling"')).toEqual([
			{ raw: '-"error handling"', body: 'error handling', negated: true, quoted: true }
		]);
	});

	it('handles mixed tokens in order', () => {
		const tokens = tokenizeQuery('word1 "phrase two" word2');
		expect(tokens).toHaveLength(3);
		expect(tokens[0]).toEqual({ raw: 'word1', body: 'word1', negated: false, quoted: false });
		expect(tokens[1]).toEqual({
			raw: '"phrase two"',
			body: 'phrase two',
			negated: false,
			quoted: true
		});
		expect(tokens[2]).toEqual({ raw: 'word2', body: 'word2', negated: false, quoted: false });
	});

	it('treats standalone dash as a non-negated token', () => {
		const tokens = tokenizeQuery('- foo');
		expect(tokens).toHaveLength(2);
		expect(tokens[0]).toEqual({ raw: '-', body: '-', negated: false, quoted: false });
	});

	it('skips empty quoted strings', () => {
		const tokens = tokenizeQuery('"" hello');
		expect(tokens).toHaveLength(1);
		expect(tokens[0].body).toBe('hello');
	});

	it('treats unclosed quote as literal text', () => {
		const tokens = tokenizeQuery('"unclosed');
		expect(tokens).toHaveLength(1);
		expect(tokens[0]).toEqual({
			raw: '"unclosed',
			body: 'unclosed',
			negated: false,
			quoted: true
		});
	});

	it('handles negated value filters', () => {
		expect(tokenizeQuery('-tool:Read')).toEqual([
			{ raw: '-tool:Read', body: 'tool:Read', negated: true, quoted: false }
		]);
	});

	it('handles complex mixed query', () => {
		const tokens = tokenizeQuery('-tool:Read "exact phrase" has:error query');
		expect(tokens).toHaveLength(4);
		expect(tokens[0].negated).toBe(true);
		expect(tokens[0].body).toBe('tool:Read');
		expect(tokens[1].quoted).toBe(true);
		expect(tokens[1].body).toBe('exact phrase');
		expect(tokens[2].body).toBe('has:error');
		expect(tokens[3].body).toBe('query');
	});
});
