import { DatabaseSync } from 'node:sqlite';
import { expect, test, vi } from 'vitest';
import { build, signedIn } from './cloud';
import { openDatabase, query } from './db';

const sample = new DatabaseSync(new URL('../../public/sample.sqlite', import.meta.url).pathname, { readOnly: true });
const perDay = 'SELECT b.plantedDt, sum(t.plantedQty) AS trees FROM bagUpView b JOIN tallyView t USING (bagUpKey) GROUP BY 1 ORDER BY 1';

/** PostgREST over the sample season, `select` and `range` honoured. */
async function central(path: string, range = '0-999'): Promise<Response> {
	const [table, q] = path.split('?');
	const cols = decodeURIComponent(q.replace('select=', '')).split(',');
	const [from, to] = range.split('-').map(Number);
	const rows = sample.prepare(`SELECT ${cols.map((c) => `"${c}"`).join(',')} FROM "${table}" LIMIT ? OFFSET ?`).all(to - from + 1, from);
	return Response.json(rows);
}

test('with no Supabase address set, as on a fork, nobody is signed in', () => {
	vi.stubEnv('PUBLIC_GC_RT_supabase_address', '');
	expect(signedIn()).toBeNull();
	vi.unstubAllEnvs();
});

test("builds the Phone schema from Central's rows, and the reports read it", async () => {
	// Pages of 100 against 926 tallies: the last short page ends each table.
	await openDatabase(await build(central, 100));
	expect(query(perDay)).toEqual(sample.prepare(perDay).all().map((r) => ({ ...r })));
	expect(query('SELECT count(*) AS n FROM tallyTable')).toEqual([sample.prepare('SELECT count(*) AS n FROM tallyTable').get()].map((r) => ({ ...r })));
});
