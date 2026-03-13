import { svelteConfig } from '@davidteju/dev-config/eslint/svelte';
import svelteConf from './svelte.config.js';

export default [
	...svelteConfig({ svelteConfig: svelteConf }),
	{
		ignores: ['workspace/**']
	},
	// Project-specific: trust rendered markdown/search highlights
	{
		files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
		rules: {
			'svelte/no-at-html-tags': 'off'
		}
	}
];
