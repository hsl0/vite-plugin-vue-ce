function generateDefineCustomElementCode(
	componentIdentifier: string,
	optionIdentifier?: string
) {
	const argList = optionIdentifier
		? [componentIdentifier, optionIdentifier]
		: [componentIdentifier];
	return `defineCustomElement(${argList.join(', ')})`;
}

function generateCustomElementDefineCode(
	name: string,
	componentIdentifier: string
): string {
	return `if(!customElements.get(${JSON.stringify(name)})) {
	customElements.define(${JSON.stringify(name)}, ${componentIdentifier});
}
`;
}

export function generateCustomElementDefineModule(
	module: string,
	ceNames: string[],
	optionModule?: string
) {
	const componentIdentifier = 'VComponent';
	const optionIdentifier = 'optionFactory';
	const customElementIdentifier = 'VCustomElement';

	return `import { defineCustomElement } from "vue";
${optionModule ? `import ${optionIdentifier} from ${JSON.stringify(optionModule)};` : ''}
import ${componentIdentifier} from ${JSON.stringify(module)};
const ${customElementIdentifier} = ${generateDefineCustomElementCode(componentIdentifier, optionModule ? `${optionIdentifier}(${componentIdentifier})` : undefined)};
${ceNames.map((name) => generateCustomElementDefineCode(name, customElementIdentifier)).join('')}`;
}
