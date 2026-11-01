import { expect, test } from 'vitest';
import type { Plugin } from './api';
import { plugins, refusal } from './host';

const plugin = (p: Partial<Plugin>): Plugin => ({ id: 'x', name: 'X', api: 1, minSchema: 57, mount: () => () => {}, ...p });

test('a plugin built for this API and an old enough file is accepted', () => {
	expect(refusal(plugin({}), 57)).toBeUndefined();
	expect(refusal(plugin({}), 58)).toBeUndefined();
});

test('a plugin built for another API major is refused', () => {
	expect(refusal(plugin({ api: 2 }), 57)).toMatch(/plugin API 2/);
});

test('a file older than the plugin understands is refused', () => {
	expect(refusal(plugin({ minSchema: 58 }), 57)).toMatch(/schema 58/);
});

test('the built-ins load in order: season, tables, schema', () => {
	expect(plugins.map((p) => p.id).slice(0, 3)).toEqual(['season', 'tables', 'schema']);
});
