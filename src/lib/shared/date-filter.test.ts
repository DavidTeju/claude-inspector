import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseDateFilter } from './date-filter.js';

describe('parseDateFilter', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2025-06-15T12:00:00'));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('parses "today" as midnight-to-end-of-day', () => {
		const result = parseDateFilter('today');
		expect(result).not.toBeNull();
		expect(new Date(result!.after).getHours()).toBe(0);
		expect(new Date(result!.before).getHours()).toBe(23);
	});

	it('parses "7d" as 7 days ago midnight to now', () => {
		const result = parseDateFilter('7d');
		expect(result).not.toBeNull();
		const afterDate = new Date(result!.after);
		expect(afterDate.getDate()).toBe(8); // June 15 - 7 = June 8
		expect(afterDate.getHours()).toBe(0);
	});

	it('parses "0d" as today', () => {
		const result = parseDateFilter('0d');
		expect(result).not.toBeNull();
		const afterDate = new Date(result!.after);
		expect(afterDate.getDate()).toBe(15);
	});

	it('parses "YYYY-MM" as entire month', () => {
		const result = parseDateFilter('2025-03');
		expect(result).not.toBeNull();
		const start = new Date(result!.after);
		const end = new Date(result!.before);
		expect(start.getMonth()).toBe(2); // March (0-based)
		expect(start.getDate()).toBe(1);
		expect(end.getMonth()).toBe(2);
		expect(end.getDate()).toBe(31);
	});

	it('parses "YYYY-MM-DD" as single day bounds', () => {
		const result = parseDateFilter('2025-03-15');
		expect(result).not.toBeNull();
		const start = new Date(result!.after);
		const end = new Date(result!.before);
		expect(start.getDate()).toBe(15);
		expect(start.getHours()).toBe(0);
		expect(end.getDate()).toBe(15);
		expect(end.getHours()).toBe(23);
	});

	it('parses "YYYY-MM-DD..YYYY-MM-DD" as explicit range', () => {
		const result = parseDateFilter('2025-03-01..2025-03-15');
		expect(result).not.toBeNull();
		const start = new Date(result!.after);
		const end = new Date(result!.before);
		expect(start.getDate()).toBe(1);
		expect(end.getDate()).toBe(15);
	});

	it('returns null for unrecognized formats', () => {
		expect(parseDateFilter('invalid')).toBeNull();
		expect(parseDateFilter('')).toBeNull();
		expect(parseDateFilter('yesterday')).toBeNull();
	});
});
