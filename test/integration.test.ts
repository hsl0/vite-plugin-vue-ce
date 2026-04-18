import { afterEach, describe, expect, it } from 'vitest';
import {
	build,
	createServer,
	type InlineConfig,
	type Plugin,
	type ViteDevServer,
} from 'vite';
import type { RolldownOutput } from 'rolldown';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vueCustomElements from '../src/index.js';

function getBuildOutputs(result: unknown): RolldownOutput[] {
	const arr = Array.isArray(result) ? result : [result];
	return arr.filter((r): r is RolldownOutput => 'output' in (r as object));
}

type BuildAssets = { js: string; html: string };

async function buildAssets(config: InlineConfig): Promise<BuildAssets> {
	const result = await build({
		...config,
		build: { ...config.build, write: false },
	});
	const outputs = getBuildOutputs(result).flatMap((o) => o.output);

	const js = outputs
		.filter(
			(c): c is (typeof outputs)[number] & { type: 'chunk'; code: string } =>
				c.type === 'chunk'
		)
		.map((c) => c.code)
		.join('');

	const html = outputs
		.filter(
			(c): c is (typeof outputs)[number] & { type: 'asset'; source: string } =>
				c.type === 'asset' && c.fileName.endsWith('.html')
		)
		.map((c) => c.source)
		.join('');

	return { js, html };
}

const fixturesDir = path.join(
	path.dirname(fileURLToPath(import.meta.url)),
	'fixtures'
);

const mockVuePlugin = (): Plugin => ({
	name: 'mock-vue',
	resolveId(id) {
		if (id === 'vue') return '\0mock-vue';
	},
	load(id) {
		if (id === '\0mock-vue')
			return 'export const defineCustomElement = (c) => c;';
		if (id.endsWith('.vue') || id.endsWith('.ce.vue'))
			return 'export default {};';
	},
});

const baseConfig = {
	root: fixturesDir,
	plugins: [vueCustomElements(), mockVuePlugin()],
	logLevel: 'silent' as const,
};

describe('build mode', () => {
	it('bundles customElements.define into output', async () => {
		const { js } = await buildAssets(baseConfig);
		expect(js).toMatch(/customElements\.define\(["'`]hello-world["'`],/);
	});

	it('does not leak virtual module prefix into JS or HTML output', async () => {
		const { js, html } = await buildAssets(baseConfig);
		expect(js).not.toContain('vue-ce-register:');
		expect(html).not.toContain('vue-ce-register:');
	});
});

describe('non-ce module isolation', () => {
	it('does not interfere with regular JS modules in the same build', async () => {
		const { js } = await buildAssets({
			...baseConfig,
			build: {
				rollupOptions: {
					input: {
						ce: path.join(fixturesDir, 'HelloWorld.ce.vue'),
						greet: path.join(fixturesDir, 'greet.js'),
					},
				},
			},
		});
		expect(js).toMatch(/customElements\.define\(["'`]hello-world["'`],/);
		expect(js).toContain('__greetings'); // greet.js content preserved
	});
});

describe('lib mode (lib: true)', () => {
	const libConfig: InlineConfig = {
		root: fixturesDir,
		plugins: [
			vueCustomElements({
				lib: true,
				customElements: {
					'hello-world': path.join(fixturesDir, 'HelloWorld.ce.vue'),
				},
			}),
			mockVuePlugin(),
		],
		logLevel: 'silent',
	};

	it('uses customElements paths as input automatically', async () => {
		const { js } = await buildAssets(libConfig);
		expect(js).toMatch(/customElements\.define\(["'`]hello-world["'`],/);
	});

	it('does not leak virtual module prefix into output', async () => {
		const { js } = await buildAssets(libConfig);
		expect(js).not.toContain('vue-ce-register:');
	});
});

describe('optionFile', () => {
	it('includes optionFactory import and call in build output', async () => {
		const optionFile = path.join(fixturesDir, 'ce-options.js');
		const { js } = await buildAssets({
			...baseConfig,
			plugins: [vueCustomElements({ optionFile }), mockVuePlugin()],
		});
		expect(js).toContain('optionFactory');
		expect(js).toMatch(/customElements\.define\(["'`]hello-world["'`],/);
	});
});

describe('dev mode', () => {
	let server: ViteDevServer;

	afterEach(async () => {
		await server?.close();
	});

	it('transforms HTML script src to /@id/ virtual module URL', async () => {
		server = await createServer({ ...baseConfig, server: { port: 0 } });
		await server.listen();

		const html = await server.transformIndexHtml(
			'/',
			`<!doctype html>
<html>
	<head>
		<script type="module" src="./HelloWorld.ce.vue"></script>
	</head>
	<body>
		<hello-world></hello-world>
	</body>
</html>`
		);

		expect(html).toContain('/@id/HelloWorld.ce.vue"');
	});

	it('serves virtual module with customElements.define code', async () => {
		server = await createServer({ ...baseConfig, server: { port: 0 } });
		await server.listen();

		const virtualId = `\0virtual:vue-ce-register:${fixturesDir}/HelloWorld.ce.vue.js`;
		const resolved = await server.pluginContainer.resolveId(virtualId);
		const loaded = await server.pluginContainer.load(resolved!.id);
		const code = typeof loaded === 'string' ? loaded : loaded?.code;

		expect(code).toContain('customElements.define("hello-world",');
	});
});
