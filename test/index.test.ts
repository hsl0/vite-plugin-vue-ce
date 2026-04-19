import { describe, it, expect, vi } from 'vitest';
import vueCustomElements from '../src/index.js';
import type { Plugin } from 'vite';

function getHooks(plugin: Plugin) {
	const transformIndexHtml = plugin.transformIndexHtml as {
		order: string;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		handler: (html: string, ctx: Record<string, any>) => string;
	};
	const load = plugin.load as {
		order: string;
		handler: (
			this: { error: (msg: string) => never },
			id: string
		) => { code: string } | null;
	};
	const resolveId = plugin.resolveId as {
		order: string;
		handler: (
			this: {
				resolve: (
					id: string,
					importer?: string
				) => Promise<{ id: string } | null>;
			},
			source: string,
			importer: string | undefined,
			options: object
		) => Promise<unknown>;
	};
	return { transformIndexHtml, load, resolveId };
}

const mockHTML = (src: string, body: string) =>
	`<!doctype html>
	<html>
		<head>
			<script type="module" src="${src}"></script>
		</head>
	<body>
		${body}
	</body>
</html>`;

describe('transformIndexHtml', () => {
	it('prepends /@id/ in dev mode', () => {
		const { transformIndexHtml } = getHooks(vueCustomElements());
		const result = transformIndexHtml.handler(
			mockHTML('./src/VApp.ce.vue', '<v-app />'),
			{
				path: '/',
				server: {},
			}
		);
		expect(result).toContain('/@id/./src/VApp.ce.vue');
	});
});

describe('load', () => {
	const mockCtx = {
		error: vi.fn((msg: string): never => {
			throw new Error(msg);
		}),
	};

	it('generates defineCustomElement and customElements.define code', () => {
		const { load } = getHooks(vueCustomElements());
		const result = load.handler.call(
			mockCtx,
			'\0virtual:vue-ce-register:/path/to/VApp.ce.vue.js'
		);
		expect(result?.code).toContain('defineCustomElement');
		expect(result?.code).toContain('customElements.define("v-app"');
		expect(result?.code).toContain(
			'import VComponent from "/path/to/VApp.ce.vue"'
		);
	});

	it('applies customElementPrefix', () => {
		const { load } = getHooks(
			vueCustomElements({ customElementPrefix: 'my-' })
		);
		const result = load.handler.call(
			mockCtx,
			'\0virtual:vue-ce-register:/path/to/VApp.ce.vue.js'
		);
		expect(result?.code).toContain('customElements.define("my-v-app",');
	});

	it('converts component filename to kebab-case element name', () => {
		const { load } = getHooks(vueCustomElements());
		const result = load.handler.call(
			mockCtx,
			'\0virtual:vue-ce-register:/path/HelloWorld.ce.vue.js'
		);
		expect(result?.code).toContain('customElements.define("hello-world",');
	});

	it('returns null for non-virtual module IDs without calling error', () => {
		const { load } = getHooks(vueCustomElements());
		const ctx = {
			error: vi.fn((msg: string): never => {
				throw new Error(msg);
			}),
		};
		const result = load.handler.call(ctx, '/some/regular/module.js');
		expect(result).toBeNull();
		expect(ctx.error).not.toHaveBeenCalled();
	});

	it('imports optionFactory and passes it to defineCustomElement when optionFile is set', () => {
		const { load } = getHooks(
			vueCustomElements({ optionFile: '/path/to/ce-options.js' })
		);
		const result = load.handler.call(
			mockCtx,
			'\0virtual:vue-ce-register:/path/to/VApp.ce.vue.js'
		);
		expect(result?.code).toContain(
			'import optionFactory from "/path/to/ce-options.js"'
		);
		expect(result?.code).toContain(
			'defineCustomElement(VComponent, optionFactory("v-app", VComponent))'
		);
	});

	it('does not import optionFactory when optionFile is not set', () => {
		const { load } = getHooks(vueCustomElements());
		const result = load.handler.call(
			mockCtx,
			'\0virtual:vue-ce-register:/path/to/VApp.ce.vue.js'
		);
		expect(result?.code).not.toContain('optionFactory');
		expect(result?.code).toContain('defineCustomElement(VComponent)');
	});
});

describe('cross-component usage: A uses B, both imported from HTML entry', () => {
	const mockCtx = {
		error: vi.fn((msg: string): never => {
			throw new Error(msg);
		}),
	};

	it('resolves both A.ce.vue and B.ce.vue from HTML entry to separate virtual modules', async () => {
		const { resolveId } = getHooks(vueCustomElements());
		const mockResolve = vi
			.fn()
			.mockImplementation((src: string) =>
				Promise.resolve({ id: src.replace('./', '/abs/') })
			);

		const resultA = await resolveId.handler.call(
			{ resolve: mockResolve },
			'./VApp.ce.vue',
			'/project/index.html',
			{}
		);
		const resultB = await resolveId.handler.call(
			{ resolve: mockResolve },
			'./HelloWorld.ce.vue',
			'/project/index.html',
			{}
		);

		expect(resultA).toMatchObject({
			id: '\0virtual:vue-ce-register:/abs/VApp.ce.vue.js',
		});
		expect(resultB).toMatchObject({
			id: '\0virtual:vue-ce-register:/abs/HelloWorld.ce.vue.js',
		});
	});

	it('does not wrap B.ce.vue in a virtual module when imported from A.ce.vue (prevents circular reference)', async () => {
		const { resolveId } = getHooks(vueCustomElements());
		// A.ce.vue imports B.ce.vue internally — importer is a .ce.vue file, not HTML
		const result = await resolveId.handler.call(
			{ resolve: vi.fn() },
			'./HelloWorld.ce.vue',
			'/abs/VApp.ce.vue',
			{}
		);
		expect(result).toBeNull();
	});

	it('generated code for virtual:A does not reference any virtual module (no circular import)', () => {
		const { load } = getHooks(vueCustomElements());
		const resultA = load.handler.call(
			mockCtx,
			'\0virtual:vue-ce-register:/abs/VApp.ce.vue.js'
		);
		expect(resultA?.code).toContain(
			'import VComponent from "/abs/VApp.ce.vue"'
		);
		expect(resultA?.code).not.toContain('\0virtual:vue-ce-register');
	});

	it('generates independent customElements.define for A and B without cross-dependency', () => {
		const { load } = getHooks(vueCustomElements());
		const resultA = load.handler.call(
			mockCtx,
			'\0virtual:vue-ce-register:/abs/VApp.ce.vue.js'
		);
		const resultB = load.handler.call(
			mockCtx,
			'\0virtual:vue-ce-register:/abs/HelloWorld.ce.vue.js'
		);

		expect(resultA?.code).toContain('customElements.define("v-app",');
		expect(resultB?.code).toContain('customElements.define("hello-world",');
		// Each module only imports its own component
		expect(resultA?.code).toContain(
			'import VComponent from "/abs/VApp.ce.vue"'
		);
		expect(resultA?.code).not.toContain('HelloWorld');
		expect(resultB?.code).toContain(
			'import VComponent from "/abs/HelloWorld.ce.vue"'
		);
		expect(resultB?.code).not.toContain('VApp');
	});
});

describe('resolveId', () => {
	it('resolves virtual: prefixed source to virtual module ID', async () => {
		const { resolveId } = getHooks(vueCustomElements());
		const mockResolve = vi
			.fn()
			.mockResolvedValue({ id: '/abs/path/VApp.ce.vue' });

		const result = await resolveId.handler.call(
			{ resolve: mockResolve },
			'\0virtual:vue-ce-register:./src/VApp.ce.vue.js',
			undefined,
			{}
		);
		expect(result).toMatchObject({
			id: '\0virtual:vue-ce-register:/abs/path/VApp.ce.vue.js',
		});
	});

	it('ignores .ce.vue import with an importer', async () => {
		const { resolveId } = getHooks(vueCustomElements());
		const result = await resolveId.handler.call(
			{ resolve: vi.fn() },
			'./VApp.ce.vue',
			'/some/importer.ts',
			{}
		);
		expect(result).toBeNull();
	});

	it('ignores non-.ce.vue modules', async () => {
		const { resolveId } = getHooks(vueCustomElements());
		const result = await resolveId.handler.call(
			{ resolve: vi.fn() },
			'./main.ts',
			undefined,
			{}
		);
		expect(result).toBeNull();
	});

	it('does not produce double \\0virtual:vue-ce-register: prefix when skipSelf is bypassed', async () => {
		// v0.2.0 added skipSelf:true but not the custom[resolving] marker.
		// If an intermediate plugin bypasses skipSelf and routes this.resolve() back
		// into the same handler, that handler wraps the source again, and the outer
		// call wraps the already-wrapped id a second time → double prefix.
		// v0.2.1 fixes this by passing custom[resolving] so re-entry returns null.
		const { resolveId } = getHooks(vueCustomElements());
		let callDepth = 0;

		const ctx = {
			resolve: vi.fn(
				async (
					src: string,
					importer?: string,
					options?: object
				): Promise<{ id: string } | null> => {
					callDepth++;
					if (callDepth === 1) {
						// First call: simulate skipSelf being bypassed — re-enter the handler
						// with the exact options the plugin passed (including any custom marker).
						const reentryResult = await resolveId.handler.call(
							ctx,
							src,
							importer,
							options ?? {}
						);
						callDepth--;
						// Return whatever the re-entered handler produced.
						// If the guard is missing, this will be a virtual module id,
						// causing the outer call to wrap it again → double prefix.
						return (
							(reentryResult as { id: string } | null) ?? {
								id: '/abs/' + src.replace('./', ''),
							}
						);
					}
					// Deeper calls: just return the real absolute path to stop recursion.
					callDepth--;
					return { id: '/abs/' + src.replace('./', '') };
				}
			),
		};

		const result = await resolveId.handler.call(
			ctx,
			'./VApp.ce.vue',
			'/project/index.html',
			{}
		);

		const prefix = '\0virtual:vue-ce-register:';
		const resultId = (result as { id?: string } | null)?.id ?? '';
		expect(resultId).not.toContain(prefix + prefix);
	});

	it('does not re-enter itself when resolving .ce.vue from HTML (no infinite loop)', async () => {
		const { resolveId } = getHooks(vueCustomElements());
		let callCount = 0;

		// Simulate Rollup without skipSelf: re-enters this plugin on every this.resolve() call.
		// If the plugin passes skipSelf:true, the mock short-circuits and returns a real id.
		// If the plugin does NOT pass skipSelf:true, callCount exceeds the limit and throws,
		// causing this test to fail.
		const ctx = {
			resolve: vi.fn(
				async (
					src: string,
					importer?: string,
					options?: object
				): Promise<{ id: string } | null> => {
					callCount++;
					if (callCount > 5)
						throw new Error(
							`Infinite loop: resolveId re-entered ${callCount} times without skipSelf`
						);
					if ((options as Record<string, unknown>)?.skipSelf)
						return { id: '/abs/' + src.replace('./', '') };
					return resolveId.handler.call(
						ctx,
						src,
						importer,
						options ?? {}
					) as Promise<{ id: string } | null>;
				}
			),
		};

		const result = await resolveId.handler.call(
			ctx,
			'./VApp.ce.vue',
			'/project/index.html',
			{}
		);
		expect(callCount).toBe(1);
		expect(result).toMatchObject({
			id: '\0virtual:vue-ce-register:/abs/VApp.ce.vue.js',
		});
	});
});
