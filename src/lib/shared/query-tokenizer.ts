/**
 * @module
 * Shared query tokenizer used by both client-side filter parsing (`parseClientFilters`)
 * and server-side search parsing (`parseStructuredQuery`). Handles quoted phrases,
 * negation prefixes, and whitespace-delimited tokens.
 */

export interface QueryToken {
	/** Original text as typed, including `-` prefix and `"..."` wrapping */
	raw: string;
	/** Content without `-` prefix or quote wrapping */
	body: string;
	/** Had a `-` prefix */
	negated: boolean;
	/** Was wrapped in `"..."` */
	quoted: boolean;
}

function skipWhitespace(text: string, pos: number): number {
	let i = pos;
	while (i < text.length && /\s/.test(text[i])) i++;
	return i;
}

function readQuoted(text: string, start: number): { body: string; end: number } {
	let i = start + 1; // skip opening quote
	while (i < text.length && text[i] !== '"') i++;
	const body = text.slice(start + 1, i);
	if (i < text.length) i++; // skip closing quote
	return { body, end: i };
}

function readWord(text: string, start: number): number {
	let i = start;
	while (i < text.length && !/\s/.test(text[i])) i++;
	return i;
}

function isNegationPrefix(text: string, pos: number): boolean {
	return text[pos] === '-' && pos + 1 < text.length && !/\s/.test(text[pos + 1]);
}

export function tokenizeQuery(input: string): QueryToken[] {
	const tokens: QueryToken[] = [];
	const trimmed = input.trim();
	if (!trimmed) return tokens;

	let i = 0;
	while (i < trimmed.length) {
		i = skipWhitespace(trimmed, i);
		if (i >= trimmed.length) break;

		const tokenStart = i;
		const negated = isNegationPrefix(trimmed, i);
		if (negated) i++;

		if (trimmed[i] === '"') {
			const { body, end } = readQuoted(trimmed, i);
			i = end;
			if (body.length > 0) {
				tokens.push({ raw: trimmed.slice(tokenStart, i), body, negated, quoted: true });
			}
		} else {
			const wordEnd = readWord(trimmed, i);
			const word = trimmed.slice(i, wordEnd);
			tokens.push({ raw: trimmed.slice(tokenStart, wordEnd), body: word, negated, quoted: false });
			i = wordEnd;
		}
	}

	return tokens;
}
