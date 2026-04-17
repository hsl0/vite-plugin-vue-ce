import { describe, it, expect } from 'vitest';
import { identityRecord, normalizeInputs } from '../src/option.js';

describe('identityRecord', () => {
	it('maps each array item to itself', () => {
		expect(identityRecord(['a', 'b', 'c'])).toEqual({ a: 'a', b: 'b', c: 'c' });
	});

	it('returns empty object for empty array', () => {
		expect(identityRecord([])).toEqual({});
	});
});

describe('normalizeInputs', () => {
	it('wraps string in a record', () => {
		expect(normalizeInputs('foo')).toEqual({ foo: 'foo' });
	});

	it('converts array to identity record', () => {
		expect(normalizeInputs(['foo', 'bar'])).toEqual({ foo: 'foo', bar: 'bar' });
	});

	it('returns object as-is', () => {
		expect(normalizeInputs({ foo: 'bar' })).toEqual({ foo: 'bar' });
	});

	it('returns empty object for undefined', () => {
		expect(normalizeInputs(undefined)).toEqual({});
	});

	it('throws TypeError for non-string non-object types', () => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		expect(() => normalizeInputs(42 as any)).toThrow(TypeError);
	});
});
