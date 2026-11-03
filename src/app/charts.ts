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
		return Plot.plot({
			...f, marginLeft: 70, marginBottom: 110, y: { grid: true, label: 'Trees' }, x: { label: null, tickRotate: -45 },
			marks: [
				Plot.barY(rows, { x: 'block', y: 'allocated', fill: accent, fillOpacity: 0.3 }),
				Plot.barY(rows, { x: 'block', y: 'trees', fill: accent, insetLeft: 4, insetRight: 4, tip: true }),
				Plot.ruleY([0]),
			],
		});
	},
};
