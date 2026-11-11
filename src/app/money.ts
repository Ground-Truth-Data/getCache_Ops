// Units are said once, in a column's header; a cell is a plain number.
const sign = (code: string, display: string) =>
	new Intl.NumberFormat('en-CA', { style: 'currency', currency: code, currencyDisplay: display }).formatToParts(0).find((p) => p.type === 'currency')?.value ?? code;

/** A currency's mark for a header: every dollar is plain $ (TreePS/KANBAN.md), the rest their own sign. */
export const mark = (code: string) => (sign(code, 'narrowSymbol').includes('$') ? '$' : sign(code, 'narrowSymbol'));

/** Money in a cell: two decimals; a rate (a price per tree) keeps up to four, or 18.5¢ would read as 19¢. */
export const amount = (v: unknown, rate = false, lang?: string) =>
	v == null ? '' : typeof v === 'number' ? v.toLocaleString(lang, { minimumFractionDigits: 2, maximumFractionDigits: rate ? 4 : 2 }) : String(v);

/** The currencies a table's rows are in; more than one means its money is never summed. */
export const currencies = (rows: readonly Record<string, unknown>[], key: string) => [...new Set(rows.map((r) => String(r[key] ?? '')))];

/** A query names its own columns, so money is inferred: a table with a currency column, and a column named like money. */
export const MONEY_NAME = /earn|price|value|pay|cost|amount|wage|income|per tree|\$/i;
export const RATE_NAME = /per tree|price/i;

/** The Σ row of one currency's rows: each numeric column summed, never a rate, a money column as money. */
export function columnTotals(rows: readonly Record<string, unknown>[], cols: readonly string[], cash: readonly string[], noSum: readonly string[], lang?: string): Record<string, string> {
	const out: Record<string, string> = {};
	for (const c of cols) {
		if (noSum.includes(c) || (cash.includes(c) && RATE_NAME.test(c))) continue;
		const vals = rows.map((r) => r[c]);
		if (!vals.length || !vals.some((v) => typeof v === 'number') || !vals.every((v) => v == null || typeof v === 'number')) continue;
		const sum = (vals as number[]).reduce((a, b) => a + (b ?? 0), 0);
		out[c] = cash.includes(c) ? amount(sum, false, lang) : sum.toLocaleString(lang);
	}
	return out;
}
