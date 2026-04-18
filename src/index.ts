import * as Cheerio from 'cheerio';
import { resolve } from 'node:path';
import { createFilter } from 'vite';

import { pascalCaseToKebabCase } from './case.js';
import {
	createVirtualModuleIDFromSrc,
	getSrcFromVirtualModule,
	virtualModulePrefix,
} from './id.js';
import { generateCustomElementDefineModule } from './snippet.js';

import type { Plugin } from 'vite';
import type { ComponentOptions, CustomElementOptions } from 'vue';

export type CustomElementOptionFactory = (
	name: string,
	component:
		| (ComponentOptions & CustomElementOptions)
		| ComponentOptions['setup']
) => CustomElementOptions;

export interface Options {
	include?: string | RegExp | (string | RegExp)[];
	exclude?: string | RegExp | (string | RegExp)[];

	customElementPrefix?: string;
	customElements?: Record<string, string>;

	optionFile?: string;

	lib?: boolean;
}

export default function vueCustomElements(pluginOptions: Options = {}): Plugin {
	const resolving = Symbol('resolving by vue-ce');
	const customElementPrefix = pluginOptions.customElementPrefix || '';
	const includeFilter = createFilter(
		pluginOptions.include,
		pluginOptions.exclude
	);
	const reverseMap = Object.entries(pluginOptions.customElements || {}).reduce<
		Record<string, string[]>
	>((rmap, [key, value]) => {
		const resolved = resolve(value);

		return {
			...rmap,
			[resolved]: [...(rmap[resolved] || []), key],
		};
	}, {}); // {componentFile: renamedComponents}
	const resolvedMap: Record<
		string,
		Set<(typeof reverseMap)[keyof typeof reverseMap][number]>
	> = {};

	return {
		name: 'vue-ce',
		options(rollupOptions) {
			return {
				...rollupOptions,
				input: pluginOptions.lib
					? Object.keys(reverseMap)
					: rollupOptions.input!,
			};
		},
		transformIndexHtml: {
			order: 'pre',
			handler(html, ctx) {
				// Prepend /@id/ on .ce.vue imports when dev server mode

				// Transform only on dev server
				if (!ctx.server) return html;

				// Only for included entry
				if (!includeFilter(ctx.path)) return html;

				const $ = Cheerio.load(html);

				// Replace .ce.vue script imports into virtual module imports in html
				$('script[src$=".ce.vue"]').attr('src', (i, src) => '/@id/' + src);

				return $.html();
			},
		},

		resolveId: {
			order: 'pre',
			async handler(source, importer, options) {
				// Handle virtual module import
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const isRequestedBySelf = options.custom?.[resolving as any];
				// Only when importing from html or .ce.vue entrypoint
				const isDirectVirtualModuleImport =
					source.startsWith(virtualModulePrefix);
				const isCustomElementModule =
					source.endsWith('.ce.vue') && includeFilter(source);
				const isEntry = !importer;
				const isImportedFromHTMLEntry =
					importer?.endsWith('.html') && includeFilter(importer);

				if (
					isRequestedBySelf ||
					!(
						isDirectVirtualModuleImport ||
						(isCustomElementModule && (isEntry || isImportedFromHTMLEntry))
					)
				)
					return null;

				// Prepare virtual module id with fully resolved module id
				const src = isDirectVirtualModuleImport
					? getSrcFromVirtualModule(source)
					: source;
				const resolved = await this.resolve(src, importer, {
					...options,
					skipSelf: true,
					custom: {
						...options,
						[resolving]: true,
					},
				});
				if (resolved) {
					if (reverseMap[src]) {
						resolvedMap[resolved.id] = new Set([
							...(resolvedMap[resolved.id] ?? []),
							...reverseMap[src],
						]);
					}
					if (reverseMap[resolve(resolved.id)]) {
						resolvedMap[resolved.id] = new Set([
							...(resolvedMap[resolved.id] ?? []),
							...reverseMap[resolve(resolved.id)]!,
						]);
					}

					return {
						...resolved,
						id: createVirtualModuleIDFromSrc(resolved.id),
						resolvedBy: 'vue-ce-register',
						moduleSideEffects: 'no-treeshake',
					};
				}
			},
		},
		load: {
			order: 'pre',
			handler(id) {
				if (!id.startsWith(virtualModulePrefix)) return null;

				const src = getSrcFromVirtualModule(id);
				const componentName = src
					.split('/')
					.at(-1)
					?.slice(0, -'.ce.vue'.length);

				if (!componentName)
					return this.error(`Invalid component name in ${src}`);

				const ceNames = Array.from(resolvedMap[src] ?? [componentName]).map(
					(name) =>
						(customElementPrefix || '') +
						pascalCaseToKebabCase(name ?? componentName)
				);

				// Generate customElement definition code
				return {
					code: generateCustomElementDefineModule(
						src,
						ceNames,
						pluginOptions.optionFile
					),
					ast: null,
					moduleSideEffects: true,
				};
			},
		},
	};
}
