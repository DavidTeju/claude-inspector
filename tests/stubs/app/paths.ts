export function resolve(...segments: string[]): string {
	return segments.join('/').replace(/\/+/g, '/');
}
