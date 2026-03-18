// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
import storybook from "eslint-plugin-storybook";

import { createConfig } from '@davidteju/dev-config/eslint';
import svelteConf from './svelte.config.js';

export default [
    ...(await createConfig({ framework: 'svelte', svelteConfig: svelteConf })),
    {
		ignores: ['workspace/**']
	},
    // Project-specific: trust rendered markdown/search highlights
    {
		files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
		rules: {
			'svelte/no-at-html-tags': 'off'
		}
	},
    ...storybook.configs["flat/recommended"]
];
