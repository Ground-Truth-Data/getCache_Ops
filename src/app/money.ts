// Money is always two decimals; a rate (a price per tree) keeps up to four, or 18.5¢ would read as 19¢.
const fmt = (lang: string, currency: string, currencyDisplay: string, rate = false) =>
	new Intl.NumberFormat(lang, { style: 'currency', currency, currencyDisplay, minimumFractionDigits: 2, maximumFractionDigits: rate ? 4 : 2 });

/** Get Cache's money rule: a narrow symbol ($, €, £), unless two currencies in `rows` share it — then CA$ / US$. */
export function moneyIn(rows: Record<string, unknown>[], lang = navigator.language, key = 'currency') {
	const codes = [...new Set(rows.map((r) => r[key]).filter((c): c is string => !!c))];
	const symbol = (c: string) => fmt(lang, c, 'narrowSymbol').formatToParts(0).find((p) => p.type === 'currency')?.value;
	const clash = new Set(codes.filter((c) => codes.some((o) => o !== c && symbol(o) === symbol(c))));
	return (v: unknown, currency: unknown, rate = false) =>
		v == null ? '' : typeof currency === 'string' && currency ? fmt(lang, currency, clash.has(currency) ? 'symbol' : 'narrowSymbol', rate).format(v as number) : String(v);
}

/** A query names its own columns, so money is inferred: a table with a currency column, and a column named like money. */
export const MONEY_NAME = /earn|price|value|pay|cost|amount|wage|income|per tree|\$/i;
export const RATE_NAME = /per tree|price/i;
