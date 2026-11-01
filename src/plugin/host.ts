import { describe, listTables, query } from '../data/db';
import { PLUGIN_API_VERSION, type Ops, type Plugin } from './api';

const modules = import.meta.glob<{ default: Plugin }>(['../plugins/*.ts', '../../custom/plugins/*.ts', '!**/*.test.ts'], {
	eager: true,
});
const order = ['season', 'tables', 'schema'];
const rank = (p: Plugin) => (order.includes(p.id) ? order.indexOf(p.id) : order.length);

/** Built-ins first, then the company's custom/plugins, each a tab. */
export const plugins = Object.values(modules)
	.map((m) => m.default)
	.sort((a, b) => rank(a) - rank(b));

/** Why this plugin can't run on this file, or undefined when it can. */
export function refusal(plugin: Plugin, schemaVersion: number): string | undefined {
	const major = Number(PLUGIN_API_VERSION.split('.')[0]);
	if (plugin.api !== major) return `Built for plugin API ${plugin.api}; this Ops runs ${PLUGIN_API_VERSION}.`;
	if (schemaVersion < plugin.minSchema) return `Needs a Get Cache file of schema ${plugin.minSchema} or newer; this one is ${schemaVersion}.`;
}

export function makeOps(): Ops {
	return {
		apiVersion: PLUGIN_API_VERSION,
		schemaVersion: query('PRAGMA user_version')[0].user_version as number,
		query,
		tables: () => listTables().map((name) => ({ name, columns: describe(name) })),
		download(filename, data) {
			const a = document.createElement('a');
			a.href = URL.createObjectURL(data instanceof Blob ? data : new Blob([data]));
			a.download = filename;
			a.click();
			URL.revokeObjectURL(a.href);
		},
	};
}
