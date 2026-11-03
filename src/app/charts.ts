import * as Plot from '@observablehq/plot';

type Row = Record<string, unknown>;
const frame = (el: HTMLElement) => ({ style: { background: 'transparent', overflow: 'visible' }, width: el.clientWidth, accent: getComputedStyle(el).getPropertyValue('--accent') });

/** The chart drawn above a report's table, by report slug. */
export const charts: Record<string, (rows: Row[], el: HTMLElement) => Element> = {
	days(rows, el) {
		const { accent, ...f } = frame(el);
		return Plot.plot({
			...f, marginLeft: 50, y: { grid: true, label: 'Trees' }, x: { type: 'utc', label: null },
			marks: [Plot.rectY(rows, { x: (d) => new Date(d.date), y: 'trees', interval: 'day', fill: accent, tip: true }), Plot.ruleY([0])],
		});
	},
	'block-totals'(rows, el) {
		const { accent, ...f } = frame(el);
		// Under ~28px a bar, slanted names pile into each other: lie the bars down so every block name reads level.
		if (f.width / rows.length < 28) {
			const label = Math.min(160, Math.max(...rows.map((r) => String(r.block).length)) * 7 + 8);
			return Plot.plot({
				...f, height: rows.length * 22 + 40, marginLeft: label, x: { grid: true, label: 'Trees', axis: 'top', ticks: f.width / 90, tickFormat: '~s' }, y: { label: null, tickFormat: (b: string) => (b.length * 7 > label ? `${b.slice(0, label / 7 - 2)}…` : b) },
				marks: [
					Plot.barX(rows, { y: 'block', x: 'allocated', fill: accent, fillOpacity: 0.3 }),
					Plot.barX(rows, { y: 'block', x: 'trees', fill: accent, insetTop: 3, insetBottom: 3, tip: true }),
					Plot.ruleX([0]),
				],
			});
		}
		return Plot.plot({
			...f, height: Math.min(400, Math.max(260, f.width * 0.7)), marginLeft: 70, marginBottom: Math.min(110, Math.max(...rows.map((r) => String(r.block).length)) * 5 + 20), y: { grid: true, label: 'Trees' }, x: { label: null, tickRotate: -45 },
			marks: [
				Plot.barY(rows, { x: 'block', y: 'allocated', fill: accent, fillOpacity: 0.3 }),
				Plot.barY(rows, { x: 'block', y: 'trees', fill: accent, insetLeft: 4, insetRight: 4, tip: true }),
				Plot.ruleY([0]),
			],
		});
	},
};
