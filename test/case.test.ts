import { describe, it, expect } from 'vitest';
import { pascalCaseToKebabCase, kebabCaseToPascalCase } from '../src/case.js';

describe('pascalCaseToKebabCase', () => {
	it('converts regular PascalCase', () => {
		expect(pascalCaseToKebabCase('HelloWorld')).toBe('hello-world');
	});

	it('handles single uppercase prefix', () => {
		expect(pascalCaseToKebabCase('VApp')).toBe('v-app');
	});

	it('handles consecutive uppercase acronyms', () => {
		expect(pascalCaseToKebabCase('MyHTMLParser')).toBe('my-html-parser');
	});

	it('handles single word', () => {
		expect(pascalCaseToKebabCase('App')).toBe('app');
	});

	it('does not split on digit-alpha boundary', () => {
		expect(pascalCaseToKebabCase('My2ndComponent')).toBe('my2nd-component');
	});

	it('returns empty string for empty input', () => {
		expect(pascalCaseToKebabCase('')).toBe('');
	});
});

describe('kebabCaseToPascalCase', () => {
	it('converts basic kebab-case', () => {
		expect(kebabCaseToPascalCase('v-app')).toBe('VApp');
	});

	it('converts regular kebab-case', () => {
		expect(kebabCaseToPascalCase('hello-world')).toBe('HelloWorld');
	});

	it('handles single word', () => {
		expect(kebabCaseToPascalCase('app')).toBe('App');
	});

	it('handles three words', () => {
		expect(kebabCaseToPascalCase('my-custom-element')).toBe('MyCustomElement');
	});

	it('returns empty string for empty input', () => {
		expect(kebabCaseToPascalCase('')).toBe('');
	});
});
