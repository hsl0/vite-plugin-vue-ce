export function identityRecord<T extends string | number | symbol>(
	arr: T[]
): { [K in T]: K } {
	return Object.fromEntries(arr.map((item) => [item, item])) as { [K in T]: K };
}

export function normalizeInputs(
	inputs?: string | string[] | Record<string, string>
) {
	if (typeof inputs === 'string') return { [inputs]: inputs };
	if (!inputs) return {};
	if (typeof inputs !== 'object')
		throw new TypeError(
			`InputOption is not compatitable with ${typeof inputs}`
		);
	if (Array.isArray(inputs)) return identityRecord(inputs);
	return inputs;
}
