/** Narrows an unknown value to a plain object, rejecting arrays and nulls. */
export function asObject(value: unknown): Record<string, unknown> | null {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
	return value as Record<string, unknown>;
}

/** Returns the value as a trimmed string, or undefined if not a string. */
export function asOptionalString(value: unknown): string | undefined {
	return typeof value === 'string' ? value.trim() : undefined;
}
