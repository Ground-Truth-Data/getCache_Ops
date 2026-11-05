import { DatabaseSync } from 'node:sqlite';
import { expect, test, vi } from 'vitest';
import { fresh } from './auth';
import { build, follow, signedIn } from './cloud';
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

/** A browser signed in to Get Cache whose token expires `inSeconds` from now; Central answers with `answer`. */
function browser(inSeconds: number, answer: (path: string) => Response) {
	vi.stubEnv('PUBLIC_GC_RT_supabase_address', 'https://dev.supabase.co');
	const session = { access_token: 't', expires_at: Math.floor(Date.now() / 1000) + inSeconds, user: { id: 'u1', email: 'p@x' } };
	vi.stubGlobal('localStorage', { getItem: (k: string) => (k === 'sb-dev-auth-token' ? JSON.stringify(session) : null) });
	vi.stubGlobal('document', { hidden: false });
	vi.stubGlobal('addEventListener', () => {});
	vi.stubGlobal('removeEventListener', () => {});
	vi.stubGlobal('fetch', async (url: string) => answer(new URL(url).pathname.replace('/rest/v1/', '')));
}
const settle = () => new Promise((r) => setTimeout(r, 300));

test("the app's lapsed token, left by a hidden Get Cache tab, is refreshed and handed back to the app", async () => {
	vi.stubEnv('PUBLIC_GC_RT_supabase_address', 'https://dev.supabase.co');
	const store = new Map([['sb-dev-auth-token', JSON.stringify({ access_token: 'old', refresh_token: 'r1', expires_at: Math.floor(Date.now() / 1000) - 60, user: { id: 'u1' } })]]);
	vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v) });
	const next = { access_token: 'new', refresh_token: 'r2', expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: 'u1', email: 'p@x' } };
	vi.stubGlobal('fetch', async () => Response.json(next));
	expect(signedIn()).toBeNull();
	expect((await fresh())?.access_token).toBe('new');
	expect(JSON.parse(store.get('sb-dev-auth-token')!).refresh_token).toBe('r2');
	expect(signedIn()).toEqual({ authId: 'u1', email: 'p@x' });
	vi.unstubAllGlobals();
	vi.unstubAllEnvs();
});

test('a first pull that fails, with nothing cached, hands over to the signed-out page instead of hanging', async () => {
	browser(3600, () => new Response('', { status: 401 }));
	const onBytes = vi.fn();
	const onOut = vi.fn();
	const stop = follow(onBytes, onOut);
	await settle();
	stop();
	expect(onBytes).not.toHaveBeenCalled();
	expect(onOut).toHaveBeenCalledOnce();
	vi.unstubAllGlobals();
	vi.unstubAllEnvs();
});

test('an account with no upload yet lands on its empty copy at once', async () => {
	browser(3600, () => Response.json([]));
	const onBytes = vi.fn();
	const stop = follow(onBytes, () => {});
	await settle();
	stop();
	expect(onBytes).toHaveBeenCalledOnce();
	await openDatabase(onBytes.mock.calls[0][0]);
	expect(query('SELECT count(*) AS n FROM tallyView')).toEqual([{ n: 0 }]);
	vi.unstubAllGlobals();
	vi.unstubAllEnvs();
});

test('a table Central lacks comes back empty, and the rest still loads', async () => {
	const lacking = (path: string, range?: string) => (path.startsWith('editNoteTable?') ? Promise.resolve(new Response('', { status: 404 })) : central(path, range));
	await openDatabase(await build(lacking));
	expect(query('SELECT count(*) AS n FROM editNoteTable')).toEqual([{ n: 0 }]);
	expect(query(perDay)).toEqual(sample.prepare(perDay).all().map((r) => ({ ...r })));
});

test("builds the Phone schema from Central's rows, and the reports read it", async () => {
	// Pages of 100 against 926 tallies: the last short page ends each table.
	await openDatabase(await build(central, 100));
	expect(query('PRAGMA user_version')).toEqual([{ user_version: 57 }]);
	expect(query(perDay)).toEqual(sample.prepare(perDay).all().map((r) => ({ ...r })));
	expect(query('SELECT count(*) AS n FROM tallyTable')).toEqual([sample.prepare('SELECT count(*) AS n FROM tallyTable').get()].map((r) => ({ ...r })));
});
