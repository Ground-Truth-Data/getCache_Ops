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

/** The Σ row: each all-number column's sum; a money column only when every row shares one currency, never a made-up total. */
export function totals(rows: Row[], columns: string[], money: string[]) {
	const currencies = new Set(rows.map((r) => r.currency));
	const out: Record<string, number | { sum: number; currency: string }> = {};
	for (const c of columns) {
		const vals = rows.map((r) => r[c]).filter((v) => v != null);
		if (!vals.length || !vals.every((v) => typeof v === 'number')) continue;
		const sum = Math.round((vals as number[]).reduce((a, b) => a + b, 0) * 1e4) / 1e4;
		if (!money.includes(c)) out[c] = sum;
		else if (currencies.size === 1 && typeof rows[0].currency === 'string') out[c] = { sum, currency: rows[0].currency };
	}
	return out;
}
