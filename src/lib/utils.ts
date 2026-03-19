/**
 * @module
 * Shared formatting and query helpers used by both the UI and the server-side
 * search/indexing code paths.
 */

import {
	MS_PER_MINUTE,
	MS_PER_HOUR,
	MS_PER_DAY,
	SECONDS_PER_MINUTE,
	HOURS_PER_DAY,
	DAYS_PER_WEEK
} from '$lib/constants.js';
import { tokenizeQuery } from '$lib/shared/query-tokenizer.js';

/** Generate a v4 UUID, with fallback for browsers lacking crypto.randomUUID. */
export function uuid(): string {
	if (typeof globalThis.crypto?.randomUUID === 'function') {
		return globalThis.crypto.randomUUID();
	}
	return uuidFromBytes();
}

const UUID_BYTE_COUNT = 16;
const UUID_VERSION_INDEX = 6;
const UUID_VARIANT_INDEX = 8;
const UUID_VERSION_MASK = 0x0f;
const UUID_VERSION_4 = 0x40;
const UUID_VARIANT_MASK = 0x3f;
const UUID_VARIANT_RFC4122 = 0x80;
const HEX_RADIX = 16;
const HEX_PAD_LENGTH = 2;
const UUID_GROUP_1 = 0;
const UUID_GROUP_2 = 8;
const UUID_GROUP_3 = 12;
const UUID_GROUP_4 = 16;
const UUID_GROUP_5 = 20;

function uuidFromBytes(): string {
	const bytes = new Uint8Array(UUID_BYTE_COUNT);
	globalThis.crypto.getRandomValues(bytes);
	bytes[UUID_VERSION_INDEX] = (bytes[UUID_VERSION_INDEX] & UUID_VERSION_MASK) | UUID_VERSION_4;
	bytes[UUID_VARIANT_INDEX] =
		(bytes[UUID_VARIANT_INDEX] & UUID_VARIANT_MASK) | UUID_VARIANT_RFC4122;
	const hex = [...bytes].map((b) => b.toString(HEX_RADIX).padStart(HEX_PAD_LENGTH, '0')).join('');
	return `${hex.slice(UUID_GROUP_1, UUID_GROUP_2)}-${hex.slice(UUID_GROUP_2, UUID_GROUP_3)}-${hex.slice(UUID_GROUP_3, UUID_GROUP_4)}-${hex.slice(UUID_GROUP_4, UUID_GROUP_5)}-${hex.slice(UUID_GROUP_5)}`;
}

/**
 * Converts a Claude project directory name to a human-readable display name.
 * Claude stores projects under mangled path segments (for example
 * `-Users-david-projects-myapp`); this helper reverses the display-facing part
 * of that encoding without attempting to reconstruct the original absolute path.
 */
export function dirNameToDisplayName(dirName: string): string {
	const name = dirName.startsWith('-') ? dirName.slice(1) : dirName;
	const parts = name.split('-');
	const projectsIdx = parts.indexOf('projects');
	if (projectsIdx !== -1 && projectsIdx < parts.length - 1) {
		return parts.slice(projectsIdx + 1).join('-');
	}
	if (parts[0] === 'Users' && parts.length > 2) {
		return parts.slice(2).join('/');
	}
	return name.replace(/-/g, '/');
}

/**
 * Converts an absolute filesystem path to the mangled directory name used by
 * Claude to store project data under `~/.claude/projects/`.
 *
 * The encoding replaces every `/` with `-`, producing names like
 * `-home-user-projects-myapp` for the path `/home/user/projects/myapp`.
 */
export function pathToProjectId(absolutePath: string): string {
	return absolutePath.replace(/\//g, '-');
}

/**
 * Detects legacy project IDs created by the old cwd double-mangling bug.
 * These IDs should usually be filtered from lists rather than displayed or
 * normalized, because they do not map cleanly back to a real Claude project.
 */
export function isDoubleMangledProjectId(projectId: string): boolean {
	return projectId.includes('--claude-projects--');
}

/**
 * Splits a search query into lowercase terms, filtering out single-character terms.
 */
export function parseSearchTerms(query: string): string[] {
	return query
		.toLowerCase()
		.split(/\s+/)
		.filter((t) => t.length > 1);
}

/**
 * Returns "1 session", "5 sessions", etc.
 */
export function pluralize(count: number, singular: string, plural?: string): string {
	return `${count} ${count === 1 ? singular : (plural ?? singular + 's')}`;
}

export function escapeHtml(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

/**
 * Formats an ISO timestamp as "HH:MM AM/PM".
 */
export function formatTime(iso: string): string {
	return new Date(iso).toLocaleTimeString('en-US', {
		hour: '2-digit',
		minute: '2-digit'
	});
}

/**
 * Highlights search terms in text by wrapping matches in <mark> tags.
 * HTML escaping happens before term replacement so the marked output stays safe
 * to inject into the DOM while still matching user-visible text.
 */
export function highlightTerms(text: string, query: string): string {
	const escapedText = escapeHtml(text);
	if (!query || !text) return escapedText;

	const terms = parseSearchTerms(query).map((term) => escapeHtml(term));
	let result = escapedText;
	for (const term of terms) {
		const regex = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
		result = result.replace(regex, '<mark class="search-highlight">$1</mark>');
	}
	return result;
}

/**
 * Formats an ISO date string as "Mon DD, HH:MM AM/PM" (or "Mon DD, YYYY, HH:MM AM/PM" for previous years).
 */
export function formatDate(iso: string): string {
	if (!iso) return '';
	const d = new Date(iso);
	const includeYear = d.getFullYear() !== new Date().getFullYear();
	return d.toLocaleDateString('en-US', {
		month: 'short',
		day: 'numeric',
		...(includeYear && { year: 'numeric' }),
		hour: '2-digit',
		minute: '2-digit'
	});
}

/**
 * Formats an ISO date string as a relative time ("Just now", "5m ago", etc.)
 */
export function formatRelativeDate(iso: string): string {
	if (!iso) return 'Unknown';
	const d = new Date(iso);
	const now = new Date();
	const diffMs = now.getTime() - d.getTime();
	const diffMins = Math.floor(diffMs / MS_PER_MINUTE);
	const diffHours = Math.floor(diffMs / MS_PER_HOUR);
	const diffDays = Math.floor(diffMs / MS_PER_DAY);

	if (diffMins < 1) return 'Just now';
	if (diffMins < SECONDS_PER_MINUTE) return `${diffMins}m ago`;
	if (diffHours < HOURS_PER_DAY) return `${diffHours}h ago`;
	if (diffDays < DAYS_PER_WEEK) return `${diffDays}d ago`;
	const includeYear = d.getFullYear() !== now.getFullYear();
	return d.toLocaleDateString('en-US', {
		month: 'short',
		day: 'numeric',
		...(includeYear && { year: 'numeric' })
	});
}

export interface ParsedFilter {
	prefix: string;
	value: string;
	raw: string;
	negated: boolean;
}

/** Filter prefixes that require an accompanying value (e.g. `tool:Read`). */
const VALUE_FILTER_PREFIXES = ['project:', 'model:', 'date:'] as const;

/** Exact-match filters that are recognised as-is (no separate value needed). */
const EXACT_FILTERS: Record<string, { prefix: string; value: string }> = {
	'has:error': { prefix: 'has', value: 'error' },
	'is:error': { prefix: 'has', value: 'error' },
	'is:subagent': { prefix: 'is', value: 'subagent' }
};

/** Tokens that activate raw search mode (not treated as filters). */
export const RAW_MODE_TOKENS = new Set(['mode:raw', 'debug:raw', 'source:raw']);

/**
 * Splits a query string into structured filters, remaining free text, and mode flags.
 * Uses the shared tokenizer to handle quoted phrases and negation.
 * Mirrors the server-side `parseStructuredQuery` logic in `src/lib/server/search.ts`,
 * so any new filter token must be added in both places to keep the UI chips and
 * the actual search backend in sync.
 */
export function parseClientFilters(text: string): {
	filters: ParsedFilter[];
	freeText: string;
	rawMode: boolean;
	regexMode: boolean;
} {
	const filters: ParsedFilter[] = [];
	const freeTokens: string[] = [];
	let rawMode = false;
	let regexMode = false;

	for (const token of tokenizeQuery(text)) {
		// Quoted tokens are always free text (phrase search)
		if (token.quoted) {
			freeTokens.push(token.raw);
			continue;
		}

		const lowerBody = token.body.toLowerCase();

		// Raw/regex mode tokens (not negatable, not filters)
		if (!token.negated && RAW_MODE_TOKENS.has(lowerBody)) {
			rawMode = true;
			continue;
		}
		if (!token.negated && lowerBody === 'mode:regex') {
			regexMode = true;
			continue;
		}

		// Exact filters
		const exactMatch = EXACT_FILTERS[lowerBody];
		if (exactMatch) {
			filters.push({
				prefix: exactMatch.prefix,
				value: exactMatch.value,
				raw: token.raw,
				negated: token.negated
			});
			continue;
		}

		// Value prefix filters
		const matchedPrefix = VALUE_FILTER_PREFIXES.find(
			(p) => lowerBody.startsWith(p) && token.body.length > p.length
		);
		if (matchedPrefix) {
			const prefix = matchedPrefix.slice(0, -1);
			const value = token.body.slice(matchedPrefix.length);
			filters.push({ prefix, value, raw: token.raw, negated: token.negated });
			continue;
		}

		freeTokens.push(token.raw);
	}

	return { filters, freeText: freeTokens.join(' '), rawMode, regexMode };
}

/**
 * Joins parsed filters and free text back into a single query string.
 */
export function rebuildQuery(filters: ParsedFilter[], freeText: string): string {
	const parts = filters.map((f) => f.raw);
	const trimmed = freeText.trim();
	if (trimmed) {
		parts.push(trimmed);
	}
	return parts.join(' ');
}

/**
 * Extracts a human-readable message from an unknown thrown value.
 */
export function getErrorMessage(error: unknown): string {
	if (error instanceof Error) return error.message;
	if (typeof error === 'string') return error;
	return 'Unknown error';
}
