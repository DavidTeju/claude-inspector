import type { Preview } from '@storybook/sveltekit';
import '../src/app.css';

const THEME_BG = {
	dark: '#0b0c10', // surface-950 dark
	light: '#f8f7f5' // surface-950 light
} as const;

function applyTheme(isDark: boolean) {
	const bg = isDark ? THEME_BG.dark : THEME_BG.light;
	const pref = isDark ? 'dark' : 'light';
	// Sync localStorage so the app's theme store doesn't override our class toggle
	if (localStorage.getItem('theme-preference') !== pref) {
		localStorage.setItem('theme-preference', pref);
	}
	document.documentElement.classList.toggle('dark', isDark);
	// Apply background to body, story canvas, and Docs page containers
	document.body.style.backgroundColor = bg;
	for (const el of document.querySelectorAll<HTMLElement>(
		'.sbdocs-preview, .sbdocs-wrapper, #storybook-root'
	)) {
		el.style.backgroundColor = bg;
	}
}

const preview: Preview = {
	parameters: {
		controls: {
			matchers: {
				color: /(background|color)$/i,
				date: /Date$/i
			}
		},
		a11y: {
			test: 'todo'
		}
	},
	globalTypes: {
		theme: {
			description: 'Color theme',
			toolbar: {
				title: 'Theme',
				icon: 'paintbrush',
				items: [
					{ value: 'dark', title: 'Dark', icon: 'moon' },
					{ value: 'light', title: 'Light', icon: 'sun' }
				],
				dynamicTitle: true
			}
		}
	},
	initialGlobals: {
		theme: 'dark'
	},
	beforeEach: async ({ globals }) => {
		applyTheme(globals.theme !== 'light');
	}
};

export default preview;
