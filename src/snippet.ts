function generateFunctionCallCode(
	functionIdentifier: string,
	argumentList: string[]
) {
	return `${functionIdentifier}(${argumentList.join(', ')})`;
}

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
) {
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

	return `import { defineCustomElement } from "vue";
${optionModule ? `import ${optionIdentifier} from ${JSON.stringify(optionModule)};` : ''}
import ${componentIdentifier} from ${JSON.stringify(module)};
${ceNames
	.map((name) =>
		generateCustomElementDefineCode(
			name,
			generateDefineCustomElementCode(
				componentIdentifier,
				optionModule
					? generateFunctionCallCode(optionIdentifier, [
							JSON.stringify(name),
							componentIdentifier,
						])
					: undefined
			)
		)
	)
	.join('')}`;
}
