function greet(name) {
	// side effect: preserved through tree-shaking
	globalThis.__greetings = `Hello, ${name}!`;
	return globalThis.__greetings;
}

greet("World");