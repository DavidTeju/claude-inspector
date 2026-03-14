export interface ModelOption {
	value: string;
	displayName: string;
}

export const FALLBACK_MODELS: readonly ModelOption[] = [
	{ value: '', displayName: 'Default' },
	{ value: 'claude-sonnet-4-6', displayName: 'Sonnet 4.6' },
	{ value: 'claude-opus-4-6', displayName: 'Opus 4.6' },
	{ value: 'claude-haiku-4-5-20251001', displayName: 'Haiku 4.5' }
];
