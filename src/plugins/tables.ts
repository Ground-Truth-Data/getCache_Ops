import type { Plugin } from '../plugin/api';
import { nextSort, type SortState, sortRows } from '../plugin/sortRows';
import { table } from '../plugin/table';

const PAGE = 200;

const cell = (v: unknown) => {
	const s = String(v ?? '');
	return /[",\r\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
};

export const csv = (rows: Record<string, unknown>[]) =>
	rows.length ? [Object.keys(rows[0]), ...rows.map(Object.values)].map((r) => r.map(cell).join(',') + '\r\n').join('') : '';

/** The rows matching `q` in any column, sorted, cut to `page` (clamped). */
export function view(rows: Record<string, unknown>[], q: string, sort: SortState, page: number) {
	const needle = q.trim().toLowerCase();
	const hits = sortRows(needle ? rows.filter((r) => Object.values(r).some((v) => String(v ?? '').toLowerCase().includes(needle))) : rows, sort);
	const last = Math.max(0, Math.ceil(hits.length / PAGE) - 1);
	const p = Math.min(page, last);
	const shown = hits.slice(p * PAGE, (p + 1) * PAGE);
	return { hits, rows: shown, page: p, last, label: `rows ${shown.length && p * PAGE + 1}–${p * PAGE + shown.length} of ${hits.length.toLocaleString()}` };
}

export default {
	id: 'tables',
	name: 'Tables',
	api: 1,
	minSchema: 57,
	mount(el, ops) {
		const names = ops
			.query("SELECT name FROM sqlite_schema WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%' ORDER BY name NOT LIKE '%View', name")
			.map((r) => r.name as string);
		const make = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string, props: object = {}) =>
			Object.assign(document.createElement(tag), { className }, props);
		const button = 'rounded-lg border border-(--accent) px-3 py-1 font-display text-(--accent) disabled:opacity-30';
		const pick = make('select', 'rounded-lg border border-rule bg-transparent px-2 py-1');
		pick.append(...names.map((n) => new Option(n, n)));
		const search = make('input', 'rounded-lg border border-rule bg-transparent px-2 py-1', { type: 'search', placeholder: 'Search' });
		const save = make('button', button);
		const prev = make('button', button, { textContent: 'Prev' });
		const next = make('button', button, { textContent: 'Next' });
		const bar = make('div', 'mb-4 flex flex-wrap items-center gap-3');
		const body = make('div', 'overflow-x-auto');
		bar.append(pick, search, save, prev, next);
		el.append(bar, body);

		let rows: Record<string, unknown>[] = [];
		let sort: SortState = { col: '', asc: true };
		let page = 0;
		let v: ReturnType<typeof view>;
		const show = () => {
			v = view(rows, search.value, sort, page);
			page = v.page;
			prev.disabled = page === 0;
			next.disabled = page === v.last;
			save.textContent = search.value.trim() ? `Download ${v.hits.length.toLocaleString()} matching rows` : 'Download all rows';
			body.replaceChildren(table(pick.value, v.rows, { by: sort, label: v.label, onSort: (col) => ((sort = nextSort(sort, col)), (page = 0), show()) }));
		};
		const load = () => {
			rows = ops.query(`SELECT * FROM "${pick.value.replaceAll('"', '""')}"`);
			sort = { col: '', asc: true };
			page = 0;
			show();
		};
		pick.value = names.find((n) => n.endsWith('View') && ops.query(`SELECT 1 FROM "${n}" LIMIT 1`).length) ?? names[0];
		pick.onchange = load;
		search.oninput = () => ((page = 0), show());
		prev.onclick = () => (page--, show());
		next.onclick = () => (page++, show());
		save.onclick = () => ops.download(`${pick.value}.csv`, csv(v.hits));
		load();
		return () => el.replaceChildren();
	},
} satisfies Plugin;
