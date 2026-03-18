/**
 * @module
 * Parses date filter values into ISO date bounds for SQL comparison.
 * Supports `today`, `Nd` (last N days), `YYYY-MM`, `YYYY-MM-DD`,
 * and `YYYY-MM-DD..YYYY-MM-DD` range syntax.
 */

const END_OF_DAY_HOUR = 23;
const END_OF_DAY_MINUTE = 59;
const END_OF_DAY_SECOND = 59;
const END_OF_DAY_MS = 999;
const DECIMAL_RADIX = 10;

function startOfDay(date: Date): Date {
	date.setHours(0, 0, 0, 0);
	return date;
}

function endOfDay(date: Date): Date {
	date.setHours(END_OF_DAY_HOUR, END_OF_DAY_MINUTE, END_OF_DAY_SECOND, END_OF_DAY_MS);
	return date;
}

function parseDaysFilter(value: string): { after: string; before: string } | null {
	const match = value.match(/^(\d+)d$/);
	if (!match) return null;

	const days = parseInt(match[1], DECIMAL_RADIX);
	const start = new Date();
	start.setDate(start.getDate() - days);
	return { after: startOfDay(start).toISOString(), before: new Date().toISOString() };
}

function parseMonthFilter(value: string): { after: string; before: string } | null {
	const match = value.match(/^(\d{4})-(\d{2})$/);
	if (!match) return null;

	const year = parseInt(match[1], DECIMAL_RADIX);
	const month = parseInt(match[2], DECIMAL_RADIX) - 1;
	const start = new Date(year, month, 1);
	const end = new Date(year, month + 1, 0);
	return { after: start.toISOString(), before: endOfDay(end).toISOString() };
}

function parseDayFilter(value: string): { after: string; before: string } | null {
	const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
	if (!match) return null;

	const d = new Date(
		parseInt(match[1], DECIMAL_RADIX),
		parseInt(match[2], DECIMAL_RADIX) - 1,
		parseInt(match[3], DECIMAL_RADIX)
	);
	return { after: d.toISOString(), before: endOfDay(new Date(d)).toISOString() };
}

function parseRangeFilter(value: string): { after: string; before: string } | null {
	const match = value.match(/^(\d{4}-\d{2}-\d{2})\.\.(\d{4}-\d{2}-\d{2})$/);
	if (!match) return null;

	const startResult = parseDateFilter(match[1]);
	const endResult = parseDateFilter(match[2]);
	if (startResult && endResult) {
		return { after: startResult.after, before: endResult.before };
	}
	return null;
}

export function parseDateFilter(value: string): { after: string; before: string } | null {
	const lower = value.toLowerCase();

	if (lower === 'today') {
		return {
			after: startOfDay(new Date()).toISOString(),
			before: endOfDay(new Date()).toISOString()
		};
	}

	return (
		parseDaysFilter(lower) ??
		parseMonthFilter(lower) ??
		parseDayFilter(lower) ??
		parseRangeFilter(lower)
	);
}
