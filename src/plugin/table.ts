import { type SortState, sortArrow } from './sortRows';

/** A plain HTML table of query rows, headed by its column names; with `sort`, a header click sorts. */
export function table(title: string, rows: Record<string, unknown>[], sort?: { by: SortState; onSort(col: string): void; label: string }): HTMLElement {
	const section = document.createElement('section');
	section.className = 'mb-8';
	section.dataset.table = title;
	const cols = Object.keys(rows[0] ?? {});
	const cell = (tag: string, text: unknown) => {
		const el = document.createElement(tag);
		el.textContent = typeof text === 'number' ? text.toLocaleString() : String(text ?? '');
		el.className = 'border-b border-rule px-3 py-1 text-left';
		return el;
	};
	const h2 = document.createElement('h2');
	h2.className = 'mb-2 font-display text-xl text-heading';
	h2.textContent = `${title} · ${sort?.label ?? `${rows.length} rows`}`;
	const t = document.createElement('table');
	t.className = 'w-full text-sm tabular-nums';
	t.append(...[cols, ...rows.map((r) => cols.map((c) => r[c]))].map((cells, i) => {
		const tr = document.createElement('tr');
		tr.append(...cells.map((c) => cell(i ? 'td' : 'th', c)));
		if (!i && sort) tr.querySelectorAll('th').forEach((th, j) => {
			th.className += ' cursor-pointer select-none whitespace-nowrap';
			th.textContent += ` ${sortArrow(sort.by, cols[j])}`;
			th.onclick = () => sort.onSort(cols[j]);
		});
		return tr;
	}));
	section.append(h2, t);
	return section;
}
