export type ThemePreference = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'theme-preference';
const VALID = ['system', 'light', 'dark'] as const satisfies readonly ThemePreference[];
const isBrowser = typeof window !== 'undefined';

function getSystemTheme(): ResolvedTheme {
	if (!isBrowser) return 'dark';
	return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(resolved: ResolvedTheme) {
	if (typeof document === 'undefined') return;
	document.documentElement.classList.toggle('dark', resolved === 'dark');
}

function resolve(pref: ThemePreference, system: ResolvedTheme): ResolvedTheme {
	return pref === 'system' ? system : pref;
}

function createThemeStore() {
	let preference = $state<ThemePreference>('system');
	let systemTheme = $state<ResolvedTheme>(getSystemTheme());
	const resolved = $derived<ResolvedTheme>(resolve(preference, systemTheme));

	if (isBrowser) {
		// Initialize from localStorage
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored && VALID.includes(stored as ThemePreference)) {
			preference = stored as ThemePreference;
		}

		// Apply initial theme (inline script handles first paint, this syncs Svelte state)
		applyTheme(resolve(preference, systemTheme));

		// Listen for OS theme changes
		window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
			systemTheme = e.matches ? 'dark' : 'light';
			if (preference === 'system') {
				applyTheme(systemTheme);
			}
		});
	}

	function setPreference(pref: ThemePreference) {
		preference = pref;
		if (isBrowser) {
			localStorage.setItem(STORAGE_KEY, pref);
			applyTheme(resolve(pref, systemTheme));
		}
	}

	function cycle() {
		const idx = VALID.indexOf(preference);
		setPreference(VALID[(idx + 1) % VALID.length]);
	}

	return {
		get preference() {
			return preference;
		},
		get resolved() {
			return resolved;
		},
		setPreference,
		cycle
	};
}

export const theme = createThemeStore();
