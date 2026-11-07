import * as Plot from '@observablehq/plot';

type Row = Record<string, unknown>;
const frame = (el: HTMLElement) => ({
	style: { background: 'transparent', overflow: 'visible' },
	width: el.clientWidth,
	accent: getComputedStyle(el).getPropertyValue('--accent'),
	// Plot's tip box is white and its text takes the page's colour: on this dark page, white on white.
	bg: getComputedStyle(document.body).backgroundColor,
});
const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format;
const num = (r: Row, k: string) => Number(r[k]) || 0;

/** Where the trees axis ends when one block would flatten the rest: past Tukey's fence (Q3 + 1.5·IQR), the axis stops just above the tallest block inside it. */
export function axisEnd(rows: Row[]): number | undefined {
	const v = rows.flatMap((r) => [num(r, 'trees'), num(r, 'allocated')]).filter((n) => n > 0).sort((a, b) => a - b);
	if (rows.length < 4) return undefined;
	const q = (p: number) => {
		const i = (v.length - 1) * p, lo = Math.floor(i);
		return v[lo] + (v[Math.ceil(i)] - v[lo]) * (i - lo);
	};
	const fence = q(0.75) + 1.5 * (q(0.75) - q(0.25));
	const inside = v.filter((n) => n <= fence);
	return inside.length < v.length ? inside.at(-1)! * 1.1 : undefined;
}

/** Blocks in the chart's order: planted ones first, then those with no trees yet, each by name. */
export const blockOrder = (rows: Row[]) =>
	[...rows].sort((a, b) => Number(!num(a, 'trees')) - Number(!num(b, 'trees')) || String(a.block).localeCompare(String(b.block))).map((r) => r.block);

/** The chart drawn above a report's table, by report slug. */
export const charts: Record<string, (rows: Row[], el: HTMLElement) => Element> = {
	days(rows, el) {
		const { accent, bg, ...f } = frame(el);
		return Plot.plot({
			...f, marginLeft: 50, y: { grid: true, label: 'Trees' }, x: { type: 'utc', label: null },
			marks: [Plot.rectY(rows, { x: (d) => new Date(d.date), y: 'trees', interval: 'day', fill: accent, tip: { fill: bg } }), Plot.ruleY([0])],
		});
	},
	'block-totals'(rows, el) {
		const { accent, bg, ...f } = frame(el);
		// A block past the axis's end runs to the edge, cut by a break, with its real numbers printed on it.
		const end = axisEnd(rows) ?? Infinity;
		const cut = (k: string) => (r: Row) => Math.min(num(r, k), end);
		const over = rows.filter((r) => Math.max(num(r, 'trees'), num(r, 'allocated')) > end);
		const real = (r: Row) => {
			const [t, a] = [num(r, 'trees'), num(r, 'allocated')];
			return t > end ? `${compact(t)} trees${a > end ? ` of ${compact(a)}` : ''}` : `${compact(a)} allocated`;
		};
		const bars = (dir: 'x' | 'y') => {
			const bar = dir === 'x' ? Plot.barX : Plot.barY;
			const pos = dir === 'x' ? { y: 'block' } : { x: 'block' };
			const inset = dir === 'x' ? { insetTop: 3, insetBottom: 3 } : { insetLeft: 4, insetRight: 4 };
			return [
				bar(rows, { ...pos, [dir]: cut('allocated'), fill: accent, fillOpacity: 0.3 }),
				bar(rows, { ...pos, [dir]: cut('trees'), fill: accent, ...inset, channels: { trees: 'trees', allocated: 'allocated' }, tip: { fill: bg, format: { [dir]: false } } }),
				Plot.text(over, { ...pos, [dir]: end, text: () => '≈', fill: bg, fontSize: 30, fontWeight: 'bold', ...(dir === 'x' ? { dx: -12, rotate: 90 } : { dy: 12 }) }),
				Plot.text(over, { ...pos, [dir]: end, text: real, fill: bg, fontWeight: 'bold', ...(dir === 'x' ? { dx: -24, textAnchor: 'end' } : { dy: 24, rotate: -90, textAnchor: 'end' }) }),
				dir === 'x' ? Plot.ruleX([0]) : Plot.ruleY([0]),
			];
		};
		// Under ~28px a bar, slanted names pile into each other: lie the bars down so every block name reads level.
		if (f.width / rows.length < 28) {
			const label = Math.min(160, Math.max(...rows.map((r) => String(r.block).length)) * 7 + 8);
			return Plot.plot({
				...f, height: rows.length * 22 + 40, marginLeft: label, x: { grid: true, label: 'Trees', axis: 'bottom', ticks: f.width / 90, tickFormat: '~s', domain: end < Infinity ? [0, end] : undefined }, y: { label: null, domain: blockOrder(rows), tickFormat: (b: string) => (b.length * 7 > label ? `${b.slice(0, label / 7 - 2)}…` : b) },
				marks: bars('x'),
			});
		}
		return Plot.plot({
			...f, height: Math.min(400, Math.max(260, f.width * 0.7)), marginLeft: 70, marginBottom: Math.min(110, Math.max(...rows.map((r) => String(r.block).length)) * 5 + 20), y: { grid: true, label: 'Trees', domain: end < Infinity ? [0, end] : undefined }, x: { label: null, domain: blockOrder(rows), tickRotate: -45 },
			marks: bars('y'),
		});
	},
};
