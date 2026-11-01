import type { Plugin } from '../plugin/api';
import { table } from '../plugin/table';

const SHOWN = 500;

const cell = (v: unknown) => {
	const s = String(v ?? '');
	return /[",\r\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
};

export const csv = (rows: Record<string, unknown>[]) =>
	rows.length ? [Object.keys(rows[0]), ...rows.map(Object.values)].map((r) => r.map(cell).join(',') + '\r\n').join('') : '';

export default {
	id: 'tables',
	name: 'Tables',
	api: 1,
	minSchema: 57,
	mount(el, ops) {
		const names = ops
			.query("SELECT name FROM sqlite_schema WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%' ORDER BY name NOT LIKE '%View', name")
			.map((r) => r.name as string);
		const bar = document.createElement('div');
		bar.className = 'mb-4 flex items-center gap-3';
		const pick = document.createElement('select');
		pick.className = 'rounded-lg border border-rule bg-transparent px-2 py-1';
		pick.append(...names.map((n) => new Option(n, n)));
		const save = document.createElement('button');
		save.className = 'rounded-lg border border-(--accent) px-3 py-1 font-display text-(--accent)';
		save.textContent = 'Download CSV';
		const note = document.createElement('span');
		note.className = 'text-sm text-muted';
		bar.append(pick, save, note);
		const body = document.createElement('div');
		el.append(bar, body);

		const all = () => ops.query(`SELECT * FROM "${pick.value.replaceAll('"', '""')}"`);
		const show = () => {
			const rows = all();
			note.textContent = rows.length > SHOWN ? `Showing the first ${SHOWN} of ${rows.length.toLocaleString()}; the CSV has them all` : '';
			body.replaceChildren(table(pick.value, rows.slice(0, SHOWN)));
		};
		pick.value = names.find((n) => n.endsWith('View') && ops.query(`SELECT 1 FROM "${n}" LIMIT 1`).length) ?? names[0];
		pick.onchange = show;
		save.onclick = () => ops.download(`${pick.value}.csv`, csv(all()));
		show();
		return () => el.replaceChildren();
	},
} satisfies Plugin;
