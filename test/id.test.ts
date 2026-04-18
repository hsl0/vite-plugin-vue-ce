import { describe, it, expect } from 'vitest';
import {
	createVirtualModuleIDFromSrc,
	getSrcFromVirtualModule,
	virtualModulePrefix,
} from '../src/id.js';

describe('createVirtualModuleIDFromSrc', () => {
	it('wraps absolute path with virtual module prefix', () => {
		expect(createVirtualModuleIDFromSrc('/abs/path/VApp.ce.vue')).toBe(
			'\0virtual:vue-ce-register:/abs/path/VApp.ce.vue.js',
		);
	});

	it('preserves relative paths as-is', () => {
		expect(createVirtualModuleIDFromSrc('./src/VApp.ce.vue')).toBe(
			'\0virtual:vue-ce-register:./src/VApp.ce.vue.js',
		);
	});

	it('always starts with virtualModulePrefix', () => {
		expect(createVirtualModuleIDFromSrc('/any/path.ce.vue')).toMatch(
			new RegExp(`^${virtualModulePrefix}`),
		);
	});
});

describe('getSrcFromVirtualModule', () => {
	it('extracts src from virtual module ID', () => {
		expect(
			getSrcFromVirtualModule(
				'\0virtual:vue-ce-register:/abs/path/VApp.ce.vue.js',
			),
		).toBe('/abs/path/VApp.ce.vue');
	});

	it('is the inverse of createVirtualModuleIDFromSrc', () => {
		const src = '/some/path/MyComp.ce.vue';
		expect(getSrcFromVirtualModule(createVirtualModuleIDFromSrc(src))).toBe(src);
	});
});
