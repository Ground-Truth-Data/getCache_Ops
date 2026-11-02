import { type SortState, sortRows } from '../plugin/sortRows';

type Row = Record<string, unknown>;
const PAGE = 200;

const cell = (v: unknown) => {
	const s = String(v ?? '');
	return /[",\r\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
};

export const csv = (rows: Row[], columns: string[]) =>
	[columns, ...rows.map((r) => columns.map((c) => r[c]))].map((r) => r.map(cell).join(',') + '\r\n').join('');

/** The rows matching `q` in any column, sorted, cut to `page` (clamped). */
export function view(rows: Row[], q: string, sort: SortState, page: number) {
	const needle = q.trim().toLowerCase();
	const hits = sortRows(needle ? rows.filter((r) => Object.values(r).some((v) => String(v ?? '').toLowerCase().includes(needle))) : rows, sort);
	const last = Math.max(0, Math.ceil(hits.length / PAGE) - 1);
	const p = Math.min(page, last);
	const shown = hits.slice(p * PAGE, (p + 1) * PAGE);
	return { hits, rows: shown, page: p, last, label: `rows ${shown.length && p * PAGE + 1}–${p * PAGE + shown.length} of ${hits.length.toLocaleString()}` };
}
