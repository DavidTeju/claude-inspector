import { browser } from '$app/environment';

const STORAGE_KEY = 'claude-inspector:filter-presets';

interface FilterPreset {
	name: string;
	query: string;
}

function loadPresets(): FilterPreset[] {
	if (!browser) return [];
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		return stored ? JSON.parse(stored) : [];
	} catch {
		return [];
	}
}

function saveToStorage(presets: FilterPreset[]) {
	if (!browser) return;
	localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
}

function createPresetStore() {
	let presets = $state<FilterPreset[]>(loadPresets());

	return {
		get list() {
			return presets;
		},
		save(name: string, query: string) {
			presets = [...presets.filter((p) => p.name !== name), { name, query }];
			saveToStorage(presets);
		},
		remove(name: string) {
			presets = presets.filter((p) => p.name !== name);
			saveToStorage(presets);
		}
	};
}

export const filterPresets = createPresetStore();
