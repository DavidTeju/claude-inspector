/**
 * Converts a Claude project directory name to a human-readable display name.
 * Strips the path-encoded prefix (e.g. "-Users-david-projects-myapp" -> "myapp")
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
 * Splits a search query into lowercase terms, filtering out single-character terms.
 */
export function parseSearchTerms(query: string): string[] {
	return query
		.toLowerCase()
		.split(/\s+/)
		.filter((t) => t.length > 1);
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
 */
export function highlightTerms(text: string, query: string): string {
	if (!query || !text) return text;
	const terms = parseSearchTerms(query);
	let result = text;
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
	const diffMins = Math.floor(diffMs / 60000);
	const diffHours = Math.floor(diffMs / 3600000);
	const diffDays = Math.floor(diffMs / 86400000);

	if (diffMins < 1) return 'Just now';
	if (diffMins < 60) return `${diffMins}m ago`;
	if (diffHours < 24) return `${diffHours}h ago`;
	if (diffDays < 7) return `${diffDays}d ago`;
	const includeYear = d.getFullYear() !== now.getFullYear();
	return d.toLocaleDateString('en-US', {
		month: 'short',
		day: 'numeric',
		...(includeYear && { year: 'numeric' })
	});
}
