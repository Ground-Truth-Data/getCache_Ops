/** The stable way to read a Get Cache file: one SQL each over the …View views, plain columns, no keys. */
export const reports = [
	{
		slug: 'planting',
		title: 'Planting',
		description: 'Trees planted each day on each block.',
		sql: `SELECT b.plantedDt AS "Date", k.blockName AS "Block", CAST(sum(t.plantedQty) AS INTEGER) AS "Trees planted",
				count(DISTINCT b.bagUpKey) AS "Bag-ups"
			FROM bagUpView b JOIN tallyView t USING (bagUpKey) LEFT JOIN blockView k USING (blockKey)
			GROUP BY b.plantedDt, b.blockKey ORDER BY b.plantedDt, k.blockName`,
	},
	{
		slug: 'trees',
		title: 'Trees',
		description: 'Trees planted per species and seedlot.',
		sql: `SELECT t.speciesCode AS "Species", coalesce(x.seedlot, t.boxTag) AS "Seedlot", CAST(sum(t.plantedQty) AS INTEGER) AS "Trees planted",
				count(DISTINCT b.plantedDt) AS "Days"
			FROM tallyView t JOIN bagUpView b USING (bagUpKey) LEFT JOIN boxView x USING (boxKey)
			GROUP BY 1, 2 ORDER BY 3 DESC`,
	},
	{
		slug: 'deliveries',
		title: 'Deliveries',
		description: 'Boxes dropped at each cache, and by whom.',
		sql: `SELECT date(d.createdAt) AS "Date", f.featureName AS "Cache", d.kind AS "Kind", x.speciesCode AS "Species", x.seedlot AS "Seedlot",
				CAST(x.boxSizeQty AS INTEGER) AS "Trees per box", p.username AS "Delivered by"
			FROM deliveryView d LEFT JOIN boxView x USING (boxKey) LEFT JOIN mapFeatureView f USING (mapFeatureKey)
				LEFT JOIN personView p ON p.personKey = d.deliveredByKey
			ORDER BY d.createdAt`,
	},
	{
		slug: 'allocation',
		title: 'Allocation',
		description: 'Trees allocated against trees planted, per block.',
		sql: `SELECT k.blockName AS "Block", CAST(k.allocatedQty AS INTEGER) AS "Allocated", CAST(coalesce(sum(t.plantedQty), 0) AS INTEGER) AS "Planted",
				CAST(k.allocatedQty - coalesce(sum(t.plantedQty), 0) AS INTEGER) AS "Left to plant"
			FROM blockView k LEFT JOIN bagUpView b USING (blockKey) LEFT JOIN tallyView t USING (bagUpKey)
			GROUP BY k.blockKey ORDER BY k.blockName`,
	},
	{
		slug: 'quality',
		title: 'Quality',
		description: 'Quality plots per survey: trees counted against plantable spots.',
		sql: `SELECT s.surveyName AS "Survey", k.blockName AS "Block", count(q.qaPlotKey) AS "Plots", CAST(sum(q.plantedQty) AS INTEGER) AS "Trees in plots",
				CAST(sum(coalesce(q.plantableSpotsOverrideQty, q.plantableSpotsQty)) AS INTEGER) AS "Plantable spots",
				round(100.0 * sum(q.plantedQty) / sum(coalesce(q.plantableSpotsOverrideQty, q.plantableSpotsQty)), 1) AS "Stocking %"
			FROM qaSurveyView s LEFT JOIN qaPlotView q USING (qaSurveyKey) LEFT JOIN blockView k ON k.blockKey = s.blockKey
			GROUP BY s.qaSurveyKey ORDER BY s.surveyName`,
	},
];
