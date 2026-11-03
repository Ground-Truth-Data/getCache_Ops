type Query = (sql: string) => Record<string, unknown>[];

/** The prompt an AI needs to write one Ops query: the rules, the open file's …View views, and the request. */
export function prompt(query: Query, request: string) {
	const views = query(
		`SELECT m.name, group_concat(p.name, ', ') AS cols FROM sqlite_schema m JOIN pragma_table_info(m.name) p
		 WHERE m.type = 'view' AND m.name LIKE '%View' GROUP BY m.name ORDER BY m.name`,
	);
	return [
		'You write one SQLite SELECT for Get Cache Ops. Read only the …View views below. Use readable column aliases in the app’s words. Return only the SQL.',
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
