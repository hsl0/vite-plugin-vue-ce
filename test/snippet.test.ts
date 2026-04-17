import { describe, it, expect } from 'vitest';
import { parse } from 'acorn';
import { generateCustomElementDefineModule } from '../src/snippet.js';

function assertValidJS(code: string) {
	expect(() =>
		parse(code, { ecmaVersion: 'latest', sourceType: 'module' }),
	).not.toThrow();
}

describe('generateCustomElementDefineModule', () => {
	it('generates syntactically valid JS for a single name', () => {
		assertValidJS(
			generateCustomElementDefineModule('/path/VApp.ce.vue', ['v-app']),
		);
	});

	it('generates syntactically valid JS for multiple names', () => {
		assertValidJS(
			generateCustomElementDefineModule('/path/VApp.ce.vue', [
				'v-app',
				'x-app',
			]),
		);
	});
});
