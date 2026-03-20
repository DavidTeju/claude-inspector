// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
import { createConfig } from '@davidteju/dev-config/eslint';
import { configs as storybookConfigs } from 'eslint-plugin-storybook';
import noInlineSvg from './eslint-rules/no-inline-svg.js';
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
	// Prevent inline SVGs — use @lucide/svelte or icons/ components
	{
		files: ['**/*.svelte'],
		ignores: [
			'src/lib/components/icons/**',
			'src/lib/components/BrandMark.svelte',
			'src/lib/components/BrandingHeader.svelte'
		],
		plugins: {
			local: { rules: { 'no-inline-svg': noInlineSvg } }
		},
		rules: {
			'local/no-inline-svg': 'error'
		}
	},
	...storybookConfigs['flat/recommended']
];
