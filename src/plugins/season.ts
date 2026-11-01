import * as Plot from '@observablehq/plot';
import type { Plugin } from '../plugin/api';
import { table } from '../plugin/table';

const reports = {
	'Trees planted per day': `
		SELECT b.plantedDt AS date, CAST(sum(t.plantedQty) AS INTEGER) AS trees, count(DISTINCT b.bagUpKey) AS bagUps
		FROM bagUpView b JOIN tallyView t USING (bagUpKey) GROUP BY b.plantedDt ORDER BY b.plantedDt`,
	'Totals per block': `
		SELECT k.blockName AS block, CAST(k.allocatedQty AS INTEGER) AS allocated, CAST(coalesce(sum(t.plantedQty), 0) AS INTEGER) AS trees,
			count(DISTINCT b.plantedDt) AS days
		FROM blockView k LEFT JOIN bagUpView b USING (blockKey) LEFT JOIN tallyView t USING (bagUpKey) GROUP BY k.blockKey ORDER BY k.blockName`,
	'Trees per seedlot': `
		SELECT t.boxTag AS seedlot, t.speciesCode AS species, CAST(sum(t.plantedQty) AS INTEGER) AS trees, count(DISTINCT b.plantedDt) AS days
		FROM tallyView t JOIN bagUpView b USING (bagUpKey) GROUP BY t.boxTag, t.speciesCode ORDER BY trees DESC`,
};

export default {
	id: 'season',
	name: 'Season',
	api: 1,
	minSchema: 57,
	mount(el, ops) {
		const rows = Object.entries(reports).map(([title, sql]) => [title, ops.query(sql)] as const);
		const [days, blocks] = rows.map(([, r]) => r);
		const accent = getComputedStyle(el).getPropertyValue('--accent');
		const style = { background: 'transparent', overflow: 'visible', marginBottom: '2rem' };
		const perDay = Plot.plot({
			style, width: el.clientWidth, marginLeft: 50, y: { grid: true, label: 'Trees' }, x: { type: 'utc', label: null },
			marks: [Plot.rectY(days, { x: (d) => new Date(d.date as string), y: 'trees', interval: 'day', fill: accent, tip: true }), Plot.ruleY([0])],
		});
		const perBlock = Plot.plot({
			style, width: el.clientWidth, marginLeft: 120, x: { grid: true, label: 'Trees' }, y: { label: null },
			marks: [
				Plot.barX(blocks, { y: 'block', x: 'allocated', fill: 'var(--color-rule)' }),
				Plot.barX(blocks, { y: 'block', x: 'trees', fill: accent, insetTop: 6, insetBottom: 6, tip: true }),
			],
		});
		const h2 = (textContent: string) => Object.assign(document.createElement('h2'), { className: 'mb-2 font-display text-xl text-heading', textContent });
		el.append(...(days.length ? [h2('Trees planted per day'), perDay] : []), ...(blocks.length ? [h2('Planted vs allocated per block'), perBlock] : []), ...rows.map(([title, r]) => table(title, r)));
		return () => el.replaceChildren();
	},
} satisfies Plugin;
