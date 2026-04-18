import { describe, it, expect, vi } from 'vitest';
import vueCustomElements from '../src/index.js';
import type { Plugin } from 'vite';

function getHooks(plugin: Plugin) {
	const transformIndexHtml = plugin.transformIndexHtml as {
		order: string;
		handler: (html: string, ctx: Record<string, any>) => string;
	};
	const load = plugin.load as {
		order: string;
		handler: (
			this: { error: (msg: string) => never },
			id: string,
		) => { code: string } | null;
	};
	const resolveId = plugin.resolveId as {
		order: string;
		handler: (
			this: {
				resolve: (
					id: string,
					importer?: string,
				) => Promise<{ id: string } | null>;
			},
			source: string,
			importer: string | undefined,
			options: object,
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
	it('replaces .ce.vue src with virtual module URL in build mode', () => {
		const { transformIndexHtml } = getHooks(vueCERegister());
		const result = transformIndexHtml.handler(
			mockHTML('./src/VApp.ce.vue', '<v-app />'),
			{
				path: '/',
				server: undefined,
			},
		);
		expect(result).toContain('virtual:vue-ce-register:./src/VApp.ce.vue.js');
		expect(result).not.toContain('/@id/');
	});

	it('prepends /@id/ in dev mode', () => {
		const { transformIndexHtml } = getHooks(vueCERegister());
		const result = transformIndexHtml.handler(
			mockHTML('./src/VApp.ce.vue', '<v-app />'),
			{
				path: '/',
				server: {},
			},
		);
		expect(result).toContain(
			'/@id/virtual:vue-ce-register:./src/VApp.ce.vue.js',
		);
	});

	it('leaves non-.ce.vue scripts untouched', () => {
		const { transformIndexHtml } = getHooks(vueCERegister());
		const result = transformIndexHtml.handler(
			mockHTML('./src/main.ts', '<v-app />'),
			{
				path: '/',
				server: undefined,
			},
		);
		expect(result).toContain('./src/main.ts');
		expect(result).not.toContain('vue-ce-register');
	});

	it('transforms multiple .ce.vue scripts', () => {
		const { transformIndexHtml } = getHooks(vueCERegister());
		const html = `<!doctype html>
<html>
	<head>
		<script type="module" src="./A.ce.vue"></script>
		<script type="module" src="./B.ce.vue"></script>
	</head>
	<body></body>
</html>`;
		const result = transformIndexHtml.handler(html, {
			path: '/',
			server: undefined,
		});
		expect(result).toContain('virtual:vue-ce-register:./A.ce.vue.js');
		expect(result).toContain('virtual:vue-ce-register:./B.ce.vue.js');
	});
});

describe('load', () => {
	const mockCtx = {
		error: vi.fn((msg: string): never => {
			throw new Error(msg);
		}),
	};

	it('generates defineCustomElement and customElements.define code', () => {
		const { load } = getHooks(vueCERegister());
		const result = load.handler.call(
			mockCtx,
			'virtual:vue-ce-register:/path/to/VApp.ce.vue.js',
		);
		expect(result?.code).toContain('defineCustomElement');
		expect(result?.code).toContain('customElements.define("v-app"');
		expect(result?.code).toContain(
			'import VComponent from "/path/to/VApp.ce.vue"',
		);
	});

	it('applies customElementPrefix', () => {
		const { load } = getHooks(vueCERegister({ customElementPrefix: 'my-' }));
		const result = load.handler.call(
			mockCtx,
			'virtual:vue-ce-register:/path/to/VApp.ce.vue.js',
		);
		expect(result?.code).toContain('customElements.define("my-v-app",');
	});

	it('converts component filename to kebab-case element name', () => {
		const { load } = getHooks(vueCERegister());
		const result = load.handler.call(
			mockCtx,
			'virtual:vue-ce-register:/path/HelloWorld.ce.vue.js',
		);
		expect(result?.code).toContain('customElements.define("hello-world",');
	});

	it('returns null for non-virtual module IDs without calling error', () => {
		const { load } = getHooks(vueCERegister());
		const ctx = { error: vi.fn((msg: string): never => { throw new Error(msg); }) };
		const result = load.handler.call(ctx, '/some/regular/module.js');
		expect(result).toBeNull();
		expect(ctx.error).not.toHaveBeenCalled();
	});

	it('imports optionFactory and passes it to defineCustomElement when optionFile is set', () => {
		const { load } = getHooks(vueCERegister({ optionFile: '/path/to/ce-options.js' }));
		const result = load.handler.call(
			mockCtx,
			'virtual:vue-ce-register:/path/to/VApp.ce.vue.js',
		);
		expect(result?.code).toContain('import optionFactory from "/path/to/ce-options.js"');
		expect(result?.code).toContain('defineCustomElement(VComponent, optionFactory(VComponent))');
	});

	it('does not import optionFactory when optionFile is not set', () => {
		const { load } = getHooks(vueCERegister());
		const result = load.handler.call(
			mockCtx,
			'virtual:vue-ce-register:/path/to/VApp.ce.vue.js',
		);
		expect(result?.code).not.toContain('optionFactory');
		expect(result?.code).toContain('defineCustomElement(VComponent)');
	});
});

describe('vueCERegister options', () => {
	it('throws TypeError for duplicate customElements paths', () => {
		const samePath = '/path/to/VApp.ce.vue';
		expect(() =>
			vueCERegister({
				customElements: {
					'v-app': samePath,
					'x-app': samePath,
				},
			}),
		).toThrow(TypeError);
	});
});

describe('resolveId', () => {
	it('resolves virtual: prefixed source to virtual module ID', async () => {
		const { resolveId } = getHooks(vueCERegister());
		const mockResolve = vi
			.fn()
			.mockResolvedValue({ id: '/abs/path/VApp.ce.vue' });

		const result = await resolveId.handler.call(
			{ resolve: mockResolve },
			'virtual:vue-ce-register:./src/VApp.ce.vue.js',
			undefined,
			{},
		);
		expect(result).toMatchObject({
			id: 'virtual:vue-ce-register:/abs/path/VApp.ce.vue.js',
		});
	});

	it('ignores .ce.vue import with an importer', async () => {
		const { resolveId } = getHooks(vueCERegister());
		const result = await resolveId.handler.call(
			{ resolve: vi.fn() },
			'./VApp.ce.vue',
			'/some/importer.ts',
			{},
		);
		expect(result).toBeNull();
	});

	it('ignores non-.ce.vue modules', async () => {
		const { resolveId } = getHooks(vueCERegister());
		const result = await resolveId.handler.call(
			{ resolve: vi.fn() },
			'./main.ts',
			undefined,
			{},
		);
		expect(result).toBeNull();
	});
});
