import { mode, setMode, resetMode, userPrefersMode } from 'mode-watcher';

export type ThemePreference = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

function createThemeStore() {
	return {
		get preference(): ThemePreference {
			return userPrefersMode.current === 'system'
				? 'system'
				: (userPrefersMode.current as ThemePreference);
		},
		get resolved(): ResolvedTheme {
			return (mode.current ?? 'dark') as ResolvedTheme;
		},
		setPreference(pref: ThemePreference) {
			if (pref === 'system') {
				resetMode();
			} else {
				setMode(pref);
			}
		},
		cycle() {
			const order: ThemePreference[] = ['system', 'light', 'dark'];
			const idx = order.indexOf(this.preference);
			this.setPreference(order[(idx + 1) % order.length]);
		}
	};
}

export const theme = createThemeStore();
