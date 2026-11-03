const lot = (a: string) => `trim(coalesce(${a}.speciesCode, '') || '/' || coalesce(${a}.boxTag, ''), '/')`;
const person = (a: string) => `coalesce(nullif(${a}.alias, ''), ${a}.username)`;
const counted = (s: string, x: string) => `coalesce(${s}.treesQty, round(${s}.boxQty * ${x}.boxSizeQty))`;
// A 3.99 m quality plot: 50.01 m², so 199.94 plots to the hectare.
const PLOTS_PER_HA = 10000 / (Math.PI * 3.99 ** 2);

/** The stable way to read a Get Cache file: one SQL each over the …View views, in the app's words, no keys. */
export const reports = [
	{
		slug: 'planting',
		title: 'Planting',
		description: 'Every tally, as the Stats bags tab shows it.',
		// A bag-up is filed on a piece (a polygon) or at a cache (a pin); Stats shows either in one slot, Ops names which.
		sql: `SELECT b.plantedDt AS "date", k.blockName AS "block",
				CASE WHEN json_extract(f.geometryJson, '$.type') <> 'Point' THEN f.featureName END AS "piece",
				CASE WHEN json_extract(f.geometryJson, '$.type') = 'Point' THEN f.featureName END AS "cache",
				'bag#' || dense_rank() OVER (PARTITION BY b.plantedDt, b.createdByKey ORDER BY b.createdAt, b.bagUpKey) AS "bag",
				strftime('%H:%M', b.createdAt, 'localtime') AS "time", ${person('p')} AS "planter", ${lot('t')} AS "lot",
				CAST(t.plantedQty AS INTEGER) AS "trees", round(t.plantedQty * t.pricePerTree, 2) AS "value", t.pricePerTree AS "per tree", t.currency AS "currency"
			FROM bagUpView b JOIN tallyView t USING (bagUpKey) LEFT JOIN blockView k USING (blockKey)
				LEFT JOIN mapFeatureView f ON f.mapFeatureKey = b.mapFeatureKey LEFT JOIN personView p ON p.personKey = b.createdByKey
			ORDER BY b.plantedDt, b.createdAt, t.createdAt`,
		money: ['value', 'per tree'],
		noSum: ['per tree'],
	},
	{
		slug: 'trees',
		title: 'Trees',
		description: 'Trees planted from each box, as the bags screen lists them.',
		sql: `SELECT ${lot('t')} AS "lot", CAST(max(x.boxSizeQty) AS INTEGER) AS "trees/box", CAST(max(x.bundleSizeQty) AS INTEGER) AS "trees/bundle",
				max(t.pricePerTree) AS "per tree", CAST(sum(t.plantedQty) AS INTEGER) AS "trees", round(sum(t.plantedQty * t.pricePerTree), 2) AS "value",
				t.currency AS "currency", count(DISTINCT b.plantedDt) AS "days", count(DISTINCT b.blockKey) AS "blocks"
			FROM tallyView t JOIN bagUpView b USING (bagUpKey) LEFT JOIN boxView x USING (boxKey)
			GROUP BY 1, t.currency ORDER BY "trees" DESC`,
		money: ['per tree', 'value'],
		noSum: ['trees/box', 'trees/bundle', 'per tree'],
	},
	{
		slug: 'deliveries',
		title: 'Deliveries',
		description: 'Each box at each cache: the last count, and the last delivery or close-out.',
		sql: `WITH d AS (SELECT *, row_number() OVER (PARTITION BY mapFeatureKey, boxKey ORDER BY createdAt DESC) AS n FROM deliveryView),
				pair AS (SELECT mapFeatureKey, boxKey FROM stockView UNION SELECT mapFeatureKey, boxKey FROM deliveryView)
			SELECT f.featureName AS "cache", k.blockName AS "block", ${lot('x')} AS "lot",
				round(coalesce(s.boxQty, s.treesQty / x.boxSizeQty), 2) AS "boxes", CAST(x.boxSizeQty AS INTEGER) AS "trees/box",
				CAST(${counted('s', 'x')} AS INTEGER) AS "total", date(s.createdAt) AS "counted", ${person('sp')} AS "counted by",
				d.kind AS "delivery", date(d.createdAt) AS "delivered", ${person('dp')} AS "delivered by"
			FROM pair JOIN mapFeatureView f ON f.mapFeatureKey = pair.mapFeatureKey LEFT JOIN blockView k ON k.blockKey = f.linkedBlockKey
				LEFT JOIN boxView x ON x.boxKey = pair.boxKey
				LEFT JOIN stockView s ON s.mapFeatureKey = pair.mapFeatureKey AND s.boxKey = pair.boxKey
				LEFT JOIN d ON d.mapFeatureKey = pair.mapFeatureKey AND d.boxKey = pair.boxKey AND d.n = 1
				LEFT JOIN personView sp ON sp.personKey = s.countedByKey LEFT JOIN personView dp ON dp.personKey = d.deliveredByKey
			ORDER BY f.featureName, "lot"`,
		noSum: ['trees/box'],
	},
	{
		slug: 'allocation',
		title: 'Allocation',
		description: 'Each block: allocated, delivered, planted, as the blocks tab shows it.',
		sql: `SELECT "block", "allocated", "calculated", "in caches" + "planted" AS "delivered", "planted", "in caches",
				coalesce("allocated", "calculated") - "planted" AS "left to plant"
			FROM (SELECT k.blockName AS "block",
				(SELECT CAST(sum(a.treesQty) AS INTEGER) FROM allocationView a WHERE a.blockKey = k.blockKey) AS "allocated",
				CASE WHEN NOT EXISTS (SELECT 1 FROM allocationView a WHERE a.blockKey = k.blockKey) THEN CAST(k.allocatedQty AS INTEGER) END AS "calculated",
				(SELECT CAST(coalesce(sum(t.plantedQty), 0) AS INTEGER) FROM bagUpView b JOIN tallyView t USING (bagUpKey) WHERE b.blockKey = k.blockKey) AS "planted",
				(SELECT CAST(coalesce(sum(${counted('s', 'x')}), 0) AS INTEGER) FROM stockView s JOIN mapFeatureView f USING (mapFeatureKey)
					LEFT JOIN boxView x ON x.boxKey = s.boxKey WHERE f.linkedBlockKey = k.blockKey) AS "in caches"
				FROM blockView k)
			ORDER BY "block"`,
	},
	{
		slug: 'quality',
		title: 'Quality',
		description: 'Each Quality 704 survey: its plots, density, quality and payment.',
		sql: `WITH p AS (SELECT q.qaSurveyKey, q.plantedQty AS planted, json_array_length(coalesce(q.faultsJson, '[]')) AS unsat,
					coalesce(q.plantableSpotsOverrideQty, q.plantableSpotsQty, round(coalesce(nullif(s.treesPerHa, 0), 1800) / ${PLOTS_PER_HA})) AS spots,
					q.isAtUserLocation = 1 AND q.mapFeatureKey IS NOT NULL AS confirmed
				FROM qaPlotView q JOIN qaSurveyView s USING (qaSurveyKey) WHERE q.plantedQty IS NOT NULL),
				v AS (SELECT s.*, count(p.planted) AS plots, coalesce(sum(p.confirmed), 0) AS confirmed, sum(p.planted) AS planted, sum(p.unsat) AS unsat,
					sum(max(0, p.spots - min(p.planted, p.spots))) AS missed, sum(max(0, p.planted - p.spots)) AS excess,
					100.0 * sum(p.planted - max(0, p.planted - p.spots) - p.unsat) / nullif(sum(p.spots), 0) AS pq
				FROM qaSurveyView s LEFT JOIN p USING (qaSurveyKey) GROUP BY s.qaSurveyKey)
			SELECT v.surveyName AS "survey", k.blockName AS "block", date(v.createdAt) AS "date", CAST(coalesce(nullif(v.treesPerHa, 0), 1800) AS INTEGER) AS "stems/ha",
				v.areaHa AS "total ha", v.plots AS "plots", v.confirmed AS "◆ occupied", CAST(v.planted AS INTEGER) AS "trees planted", v.unsat AS "faults", CAST(v.missed AS INTEGER) AS "missed",
				CAST(v.excess AS INTEGER) AS "excess",
				round(100.0 * v.planted / nullif(v.plots, 0) * ${PLOTS_PER_HA} / coalesce(nullif(v.treesPerHa, 0), 1800)) AS "Density",
				round(v.pq, 1) AS "Quality", round(max(0, min(100, v.pq * 1.08 - (100 - v.pq * 1.08) * (100 - v.pq * 1.08) / 8)), 1) AS "Payment"
			FROM v LEFT JOIN blockView k ON k.blockKey = v.blockKey
			ORDER BY v.createdAt`,
		noSum: ['stems/ha', 'Density', 'Quality', 'Payment'],
	},
];
