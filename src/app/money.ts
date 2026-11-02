const fmt = (lang: string, currency: string, currencyDisplay: string) =>
	new Intl.NumberFormat(lang, { style: 'currency', currency, currencyDisplay, maximumFractionDigits: 4 });

/** Get Cache's money rule: a narrow symbol ($, €, £), unless two currencies in `rows` share it — then CA$ / US$. */
export function moneyIn(rows: Record<string, unknown>[], lang = navigator.language) {
	const codes = [...new Set(rows.map((r) => r.currency).filter((c): c is string => !!c))];
	const symbol = (c: string) => fmt(lang, c, 'narrowSymbol').formatToParts(0).find((p) => p.type === 'currency')?.value;
	const clash = new Set(codes.filter((c) => codes.some((o) => o !== c && symbol(o) === symbol(c))));
	return (v: unknown, currency: unknown) =>
		v == null ? '' : typeof currency === 'string' && currency ? fmt(lang, currency, clash.has(currency) ? 'symbol' : 'narrowSymbol').format(v as number) : String(v);
}
