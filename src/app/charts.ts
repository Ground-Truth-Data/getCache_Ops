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
	blocks(rows, el) {
		const { accent, ...f } = frame(el);
		return Plot.plot({
			...f, marginLeft: 120, x: { grid: true, label: 'Trees' }, y: { label: null },
			marks: [
				Plot.barX(rows, { y: 'block', x: (d) => d.allocated ?? d.calculated, fill: 'var(--color-rule)' }),
				Plot.barX(rows, { y: 'block', x: 'planted', fill: accent, insetTop: 6, insetBottom: 6, tip: true }),
			],
		});
	},
};
