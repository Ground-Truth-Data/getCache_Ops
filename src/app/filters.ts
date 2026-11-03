type Row = Record<string, unknown>;
const ISO = /^\d{4}-\d{2}-\d{2}/;
const SORTS = [['date', 'newest'], ['block', 'block'], ['planter', 'planter'], ['cache', 'cache'], ['survey', 'survey'], ['lot', 'lot']];

/** What a report's rows can be filtered by: its date column, up to 3 natural sorts, and the text columns with few values. */
export function facets(rows: Row[]) {
	const columns = Object.keys(rows[0] ?? {});
	const dateCol = columns.find((c) => rows.some((r) => ISO.test(String(r[c]))) && rows.every((r) => r[c] == null || ISO.test(String(r[c]))));
	const sorts = SORTS.filter(([c]) => columns.includes(c)).slice(0, 3);
	const picks = columns
		.filter((c) => rows.every((r) => r[c] == null || (typeof r[c] === 'string' && !ISO.test(r[c]))))
		.map((c) => [c, [...new Set(rows.map((r) => r[c] as string).filter(Boolean))].sort()] as const)
		.filter(([, values]) => values.length > 1 && values.length <= 30);
	return { dateCol, sorts, picks };
}

export type Filter = { sort?: string; pick: Record<string, string>; season?: boolean; days?: number; from?: string; to?: string };

/**
 * The rows that pass `f`; `days` counts back from the newest row's date, the newest day included.
 * The season is the newest row's calendar year, as the app's inbox counts it.
 */
export function apply(rows: Row[], f: Filter, dateCol?: string) {
	const day = (r: Row) => String(r[dateCol!] ?? '').slice(0, 10);
	const newest = rows.map(day).reduce((a, b) => (b > a ? b : a), '');
	let { from, to } = f;
	if (dateCol && f.days) {
		from = new Date(Date.parse(newest) - (f.days - 1) * 86_400_000).toISOString().slice(0, 10);
		to = undefined;
	}
	const season = `${newest.slice(0, 4)}-01-01`;
	if (dateCol && f.season && newest && !(from && from > season)) from = season;
	const out = rows.filter(
		(r) => Object.entries(f.pick).every(([c, v]) => !v || r[c] === v) && (!dateCol || ((!from || day(r) >= from) && (!to || day(r) <= to))),
	);
	if (!f.sort) return out;
	const s = f.sort;
	const sign = s === dateCol ? -1 : 1;
	return out.toSorted((a, b) => sign * String(a[s] ?? '').localeCompare(String(b[s] ?? ''), undefined, { numeric: true }));
}
