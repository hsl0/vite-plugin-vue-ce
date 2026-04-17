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
	component: (ComponentOptions & CustomElementOptions) | ComponentOptions['setup'],
) => CustomElementOptions;

export interface Options {
	include?: string | RegExp | (string | RegExp)[];
	exclude?: string | RegExp | (string | RegExp)[];

	customElementPrefix?: string;
	customElements?: Record<string, string>;

	optionFile?: string;

	lib?: boolean;
}

export default function vueCERegister(pluginOptions: Options = {}): Plugin {
	const customElementPrefix = pluginOptions.customElementPrefix || '';
	const includeFilter = createFilter(pluginOptions.include, pluginOptions.exclude);
	const reverseMap = Object.entries(pluginOptions.customElements || {}).reduce<
		Record<string, string>
	>((rmap, [key, value]) => {
		const resolved = resolve(value);

		if (rmap[resolved])
			throw new TypeError(
				`Duplicated custom element definition: ${resolved} for ${rmap[resolved]} and ${key}`,
			);

		return {
			...rmap,
			[resolve(value)]: key,
		};
	}, {}); // {componentFile: renamedComponents[]}
	const resolvedMap: Record<string, (typeof reverseMap)[keyof typeof reverseMap]> =
		{};

	return {
		name: 'vue-ce-register',
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
				if (!includeFilter(ctx.path)) return html;

				const $ = Cheerio.load(html);

				// Replace .ce.vue script imports into virtual module imports in html
				$('script[src$=".ce.vue"]').attr(
					'src',
					(i, src) =>
						(ctx.server ? '/@id/' : '') +
						createVirtualModuleIDFromSrc(src),
				);

				return $.html();
			},
		},

		resolveId: {
			order: 'pre',
			async handler(source, importer, options) {
				// Only when directly importing virtual module (from html) or .ce.vue entrypoint
				if (
					!(
						source.startsWith(virtualModulePrefix) ||
						(source.endsWith('.ce.vue') &&
							!importer &&
							includeFilter(source))
					)
				)
					return null;

				// Prepare virtual module id with fully resolved module id
				const src = source.startsWith(virtualModulePrefix)
					? getSrcFromVirtualModule(source)
					: source;
				const resolved = await this.resolve(src, importer, options);
				if (resolved) {
					if (src in reverseMap) {
						resolvedMap[resolved.id] = reverseMap[src]!;
					}
					if (resolve(resolved.id) in reverseMap) {
						resolvedMap[resolved.id] = reverseMap[resolve(resolved.id)]!;
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
			handler(id, loadOptions) {
				if (!id.startsWith(virtualModulePrefix)) return null;

				const src = getSrcFromVirtualModule(id);
				const componentName = src
					.split('/')
					.at(-1)
					?.slice(0, -'.ce.vue'.length);

				if (!componentName)
					return this.error(`Invalid component name in ${src}`);

				const ceName =
					(customElementPrefix || '') +
					pascalCaseToKebabCase(resolvedMap[src] ?? componentName);

				// Generate customElement definition code
				return {
					code: generateCustomElementDefineModule(
						src,
						[ceName],
						pluginOptions.optionFile,
					),
					ast: null,
					moduleSideEffects: true,
				};
			},
		},
	};
}
