import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import pluginVue from 'eslint-plugin-vue';
import json from '@eslint/json';
import markdown from '@eslint/markdown';
import { defineConfig } from 'eslint/config';

export default defineConfig([
	{
		ignores: ['dist/**', 'types/**', 'package-lock.json'],
	},
	{
		files: [
			'src/**/*.{js,mjs,cjs,ts,mts,cts,vue}',
			'dist/**/*.{js,mjs,cjs,ts,mts,cts,vue}',
		],
		plugins: { js },
		extends: ['js/recommended'],
		languageOptions: { globals: globals.node },
	},
	tseslint.configs.recommended,
	pluginVue.configs['flat/essential'].map((config) => ({
		...config,
		files: ['**/*.vue'],
	})),
	{
		files: ['**/*.vue'],
		languageOptions: { parserOptions: { parser: tseslint.parser } },
	},
	{
		files: ['**/*.json'],
		ignores: ['tsconfig.json'],
		plugins: { json },
		language: 'json/json',
		extends: ['json/recommended'],
	},
	{
		files: ['**/*.jsonc', 'tsconfig.json'],
		plugins: { json },
		language: 'json/jsonc',
		extends: ['json/recommended'],
	},
	{
		files: ['**/*.md'],
		plugins: { markdown },
		language: 'markdown/gfm',
		extends: ['markdown/recommended'],
	},
]);
