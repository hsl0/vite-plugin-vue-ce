export function pascalCaseToKebabCase(pascalCase: string): string {
	return (
		pascalCase
			.replace(/([a-z0-9])([A-Z])/g, '$1-$2')
			.replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
			.toLowerCase() ?? ''
	);
}

export function kebabCaseToPascalCase(kebabCase: string): string {
	return kebabCase
		.split('-')
		.map(
			(fragment) =>
				(fragment.at(0) ?? '').toUpperCase() + fragment.slice(1).toLowerCase()
		)
		.join('');
}
