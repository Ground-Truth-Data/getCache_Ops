// Units are said once, in a column's header; a cell is a plain number.
const sign = (code: string, display: string) =>
	new Intl.NumberFormat('en-CA', { style: 'currency', currency: code, currencyDisplay: display }).formatToParts(0).find((p) => p.type === 'currency')?.value ?? code;

/** A currency's mark for a header: Canadian dollars are plain $, any other dollar says whose (US$), the rest their own sign. */
export const mark = (code: string) => (code === 'CAD' ? '$' : sign(code, 'narrowSymbol') === '$' ? sign(code, 'symbol') : sign(code, 'narrowSymbol'));

/** Money in a cell: two decimals; a rate (a price per tree) keeps up to four, or 18.5¢ would read as 19¢. */
export const amount = (v: unknown, rate = false, lang?: string) =>
	v == null ? '' : typeof v === 'number' ? v.toLocaleString(lang, { minimumFractionDigits: 2, maximumFractionDigits: rate ? 4 : 2 }) : String(v);

/** Dollars and pounds never share a column, so rows split by currency, the biggest group first. */
export function byCurrency<R extends Record<string, unknown>>(rows: readonly R[], key: string): [string, R[]][] {
	const groups = new Map<string, R[]>();
	for (const r of rows) {
		const c = String(r[key] ?? '');
		groups.set(c, [...(groups.get(c) ?? []), r]);
	}
	return [...groups].sort((a, b) => b[1].length - a[1].length);
}

/** A query names its own columns, so money is inferred: a table with a currency column, and a column named like money. */
export const MONEY_NAME = /earn|price|value|pay|cost|amount|wage|income|per tree|\$/i;
export const RATE_NAME = /per tree|price/i;
