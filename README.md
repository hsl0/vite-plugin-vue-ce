# vite-plugin-vue-ce

Automatically register Vue custom elements by using HTML script tags.

## Installation

```sh
npm install vite-plugin-vue-ce --save-dev
```

## Usage

```js
// vite.config.js
import vue from '@vitejs/plugin-vue';
import vueCustomElements from 'vite-plugin-vue-ce';

export default {
	plugins: [vueCustomElements(), vue()],
};
```

```html
<!-- index.html -->
<!DOCTYPE html>
<html>
	<head>
		<script type="module" src="./src/components/MyComponent.ce.vue"></script>
	</head>
	<body>
		<my-component></my-component>
	</body>
</html>
```

## Options

### customElements

```js
vueCustomElements({
	customElements: {
		YourComponent: './src/components/MyComponent.ce.vue',
		'x-app': './src/components/VApp.ce.vue',
	},
});
```

```ts
interface Options {
	customElements?: Record<string, string>;
}
```

Maps a custom element name to a component file path.

The key is the element name (PascalCase or kebab-case) and the value is the component file path. PascalCase keys are converted to kebab-case automatically (e.g. `MyComponent` → `my-component`).

Required when the [`lib`](#lib) option is `true`.

### lib

```js
vueCustomElements({
	customElements: { ... },
	lib: true
})
```

```ts
interface Options {
	lib?: boolean;
}
```

When `true`, Vite generates a single JS file that registers the custom elements explicitly listed in the [`customElements`](#customelements) option.

When `false` (default), Vite generates assets for `index.html` including the custom elements referenced in it.

### optionFile

```js
vueCustomElements({
	optionFile: './src/ce-options.js',
});
```

```js
// ./src/ce-options.js
import { pinia } from './store';

export default (name, component) => ({
	shadowRoot: false,
	configureApp(app) {
		app.use(pinia);
	},
});
```

```ts
interface Options {
	optionFile?: string;
}

type CustomElementOptionFactory = (
	name: string,
	component:
		| (ComponentOptions & CustomElementOptions)
		| ComponentOptions['setup']
) => CustomElementOptions;
```

Specifies a module whose default export is a factory function. The factory receives the custom element name and component options and returns [`CustomElementOptions`](https://vuejs.org/api/custom-elements.html#definecustomelement), passed as the second argument to `defineCustomElement`. Applies to all custom elements registered by this plugin.

### customElementPrefix

```js
vueCustomElements({
	customElementPrefix: 'x-',
});
```

```ts
interface Options {
	customElementPrefix?: string;
}
```

Prepends a prefix to all custom element names registered by this plugin, including those explicitly mapped via [`customElements`](#customelements). For example, with `customElementPrefix: 'x-'`, `MyComponent` becomes `x-my-component`.

### include

```js
vueCustomElements({
	include: ['templates/**/*.html', 'components/**/*.ce.vue'],
});
```

```ts
interface Options {
	include?: string | RegExp | (string | RegExp)[];
}
```

Restricts auto custom element registration to matched files only.

Vue components not matched by this option will not be registered as custom elements, and `.ce.vue` script tags in unmatched HTML entry points will not be transformed.

The default value is `[/\.ce\.vue$/, /\.html$/]`.

### exclude

```js
vueCustomElements({
	exclude: ['static/**/*.html', 'private/**/*.ce.vue'],
});
```

```ts
interface Options {
	exclude?: string | RegExp | (string | RegExp)[];
}
```

Disables auto custom element registration for matched files.

Vue components matched by this option will not be registered as custom elements, and `.ce.vue` script tags in matched HTML entry points will not be transformed.

## License

MIT
