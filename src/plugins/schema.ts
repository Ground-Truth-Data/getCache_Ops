import type { Plugin } from '../plugin/api';
import { table } from '../plugin/table';

export default {
	id: 'schema',
	name: 'Schema',
	api: 1,
	minSchema: 57,
	mount(el, ops) {
		el.append(
			...ops.tables().map(({ name, columns }) =>
				table(name, columns.map((c) => ({ column: c.name, type: c.type, required: c.notNull ? 'yes' : '', key: c.primaryKey ? 'yes' : '' }))),
			),
		);
		return () => el.replaceChildren();
	},
} satisfies Plugin;
