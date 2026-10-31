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
		el.append(...Object.entries(reports).map(([title, sql]) => table(title, ops.query(sql))));
		return () => el.replaceChildren();
	},
} satisfies Plugin;
