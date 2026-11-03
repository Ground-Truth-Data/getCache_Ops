type Query = (sql: string) => Record<string, unknown>[];

// What the views can't say about tree planting. A number with no "whose" or "over how many" misleads.
const DOMAIN = `How tree planting works in this file:
- One file can hold one planter's work or a whole crew's (a foreman's). A bag-up is one planter's load for one day: bagUpView.createdByKey is the planter, plantedDt the day, workMode planting/fruit/cones/seeds, blockKey the block. A tally is trees of one box planted from that bag-up, so a tally's planter is its bag-up's createdByKey.
- Requests are usually loose ("the top 10 planting days this season"): they rarely say whose tallies, or whether money matters. Never pick one reading silently; answer so every reading can be read off the result, and put each choice in a column name, e.g. "Trees (everyone)".
- Every figure must say whose it is. "My", "mine" or "I" means the file's owner only. Otherwise count everyone, and add a "Planters" column (COUNT DISTINCT planters) so a crew's day is never read as one person's. When it counts more than one planter, also add a "Top planter" and "Their trees" column, so the planter asking can find their own day in it.
- Trees are the measure unless money is asked for, but an "Earnings" column beside trees costs nothing and answers the next question.
- The file's owner ("me", "my") is personIdTable.personKey where personId = (SELECT personId FROM userProfile WHERE userProfileId = 'singleton').
- A person's name is COALESCE(NULLIF(username, ''), alias) in personView; follow sameAsKey when set (that person turned out to be another one).
- Blocks: blockView.blockName via blockKey. A per-day or per-planter figure gets a "Blocks" column (COUNT DISTINCT blockKey). allocatedQty is the trees a block was given; compare it with trees planted.
- Money: earnings are plantedQty × pricePerTree in that tally's currency. Never add across currencies: group by currency instead.
- Quality: a survey (qaSurveyView) checks one block; its plots are qaPlotView rows by qaSurveyKey; the checker is the survey's createdByKey. Every quality figure says which block and survey it covers, with "Surveys" and "Plots" count columns when it covers more than one.
- "This season" is the calendar year of the newest plantedDt in the file, never today's date: an old file still shows its own season.
- The views show live rows only: edits and deletes are already applied.`;

/** The prompt an AI needs to write one Ops query: the rules, the domain, the open file's …View views, and the request. */
export function prompt(query: Query, request: string) {
	const views = query(
		`SELECT m.name, group_concat(p.name, ', ') AS cols FROM sqlite_schema m JOIN pragma_table_info(m.name) p
		 WHERE m.type = 'view' AND m.name LIKE '%View' GROUP BY m.name ORDER BY m.name`,
	);
	return [
		'You write one SQLite SELECT for Get Cache Ops. Read only the …View views below. Use readable column aliases in the app’s words. Return only the SQL.',
		DOMAIN,
		views.map((v) => `${v.name}(${v.cols})`).join('\n'),
		`Request: ${request}`,
	].join('\n\n');
}

/** Why `sql` won't run here, or undefined: Ops runs one SELECT (or WITH) and nothing else. */
export function refusal(sql: string) {
	const one = sql.trim().replace(/;\s*$/, '');
	if (!/^(select|with)\b/i.test(one)) return 'Only a SELECT (or WITH … SELECT) runs here.';
	if (one.includes(';')) return 'One statement at a time.';
}
