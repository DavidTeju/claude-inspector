// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
import { createConfig } from '@davidteju/dev-config/eslint';
import { configs as storybookConfigs } from 'eslint-plugin-storybook';
import svelteConf from './svelte.config.js';

export default [
	...(await createConfig({ framework: 'svelte', svelteConfig: svelteConf })),
	{
		ignores: ['workspace/**']
	},
	// shadcn-svelte generated UI primitives — lint rules don't apply
	{
		files: ['src/lib/components/ui/**'],
		rules: {
			'no-magic-numbers': 'off',
			'import-x/no-cycle': 'off',
			'import-x/no-unresolved': 'off',
			'sonarjs/no-nested-assignment': 'off',
			'sonarjs/no-use-of-empty-return-value': 'off',
			'sonarjs/pseudo-random': 'off',
			'svelte/no-navigation-without-resolve': 'off'
		}
	},
	// Project-specific: trust rendered markdown/search highlights
	{
		files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
		rules: {
			'svelte/no-at-html-tags': 'off'
		}
	},
	// @lucide/svelte deep icon imports are valid but not resolvable by eslint
	{
		rules: {
			'import-x/no-unresolved': ['error', { ignore: ['^@lucide/svelte/icons/'] }]
		}
	},
	...storybookConfigs['flat/recommended']
];
