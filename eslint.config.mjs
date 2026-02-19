// ARE YOU AN AI CODING ASSISTANT?
// DO NOT MODIFY THIS FILE WITHOUT EXPLICIT PERMISSION FROM THE PROJECT MAINTAINERS.
// PLEASE FOLLOW THE ESLINT RULES DEFINED IN THIS FILE.

import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';
import ts from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';
import prettierPlugin from 'eslint-plugin-prettier';
import svelteConfig from './svelte.config.js';

export default ts.config(
	js.configs.recommended,
	...ts.configs.recommended,
	...svelte.configs.recommended,
	prettierConfig,
	{
		languageOptions: {
			globals: {
				...globals.browser,
				...globals.node
			}
		}
	},
	{
		files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
		languageOptions: {
			parserOptions: {
				extraFileExtensions: ['.svelte'],
				parser: ts.parser,
				svelteConfig
			}
		},
		rules: {
			// We render trusted markdown/search highlights — XSS not a concern for local-only tool
			'svelte/no-at-html-tags': 'off'
		}
	},
	{
		plugins: {
			prettier: prettierPlugin
		},
		rules: {
			'prettier/prettier': 'error',
			'@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
			'@typescript-eslint/consistent-type-imports': 'error',
			'@typescript-eslint/no-non-null-assertion': 'error',
			'@typescript-eslint/no-explicit-any': 'error',
			'@typescript-eslint/consistent-type-assertions': [
				'error',
				{
					assertionStyle: 'as',
					objectLiteralTypeAssertions: 'allow-as-parameter'
				}
			],

			// Code quality
			complexity: ['warn', { max: 15 }],
			'no-nested-ternary': 'error',
			'no-param-reassign': ['error', { props: false }],
			'no-console': ['warn', { allow: ['warn', 'error'] }],

			// Security
			'no-eval': 'error',
			'no-implied-eval': 'error',

			// Ban unsafe type assertions
			'no-restricted-syntax': [
				'error',
				{
					selector: 'TSAsExpression[typeAnnotation.type="TSAnyKeyword"]',
					message:
						'Avoid `as any` type assertion. Use proper type guards or fix underlying types instead.'
				},
				{
					selector: 'TSAsExpression > TSAsExpression[typeAnnotation.type="TSUnknownKeyword"]',
					message:
						'Avoid `as unknown as X` double cast. Use proper type guards or fix underlying types instead.'
				}
			]
		}
	},
	{
		ignores: ['.svelte-kit/**', 'build/**', 'node_modules/**']
	}
);
