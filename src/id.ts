export const virtualModulePrefix = 'virtual:vue-ce-register:';

export function createVirtualModuleIDFromSrc(src: string): string {
	return `${virtualModulePrefix}${src}.js`;
}

export function getSrcFromVirtualModule(virtualModule: string): string {
	return virtualModule.slice(virtualModulePrefix.length, -'.js'.length);
}
