import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { expect, test, vi } from 'vitest';
import { fresh } from './auth';
import { build, follow, signedIn } from './cloud';
import { openDatabase, query } from './db';

const file = new URL('../../public/sample.sqlite', import.meta.url).pathname;
const sample = new DatabaseSync(file, { readOnly: true });
const perDay = 'SELECT b.plantedDt, sum(t.plantedQty) AS trees FROM bagUpView b JOIN tallyView t USING (bagUpKey) GROUP BY 1 ORDER BY 1';
// The sample's live tables are filled on open, as a phone's file is.
await openDatabase(readFileSync(file));
const perDayInSample = query(perDay);

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
	expect(query(perDay)).toEqual(perDayInSample);
});

test('a company deleted on the phone is gone from the reports, a renamed one shows its new name', async () => {
	const names = [
		{ versionKey: 'a1', orgKey: 'acme', orgName: 'Acme', color: '', createdAt: '2026-11-01', replacedAt: '', replacesKey: '', isDeleted: 0 },
		{ versionKey: 'a2', orgKey: 'acme', orgName: 'Acme Ltd', color: '', createdAt: '2026-11-02', replacedAt: '', replacesKey: 'a1', isDeleted: 0 },
		{ versionKey: 'b1', orgKey: 'gone', orgName: 'Gone Co', color: '', createdAt: '2026-11-01', replacedAt: '', replacesKey: '', isDeleted: 0 },
		{ versionKey: 'b2', orgKey: 'gone', orgName: 'Gone Co', color: '', createdAt: '2026-11-02', replacedAt: '', replacesKey: 'b1', isDeleted: 1 },
	];
	const only = async (path: string) => Response.json(path.startsWith('orgNameTable?') ? names : []);
	await openDatabase(await build(only));
	expect(query('SELECT orgKey, orgName FROM orgNameView')).toEqual([{ orgKey: 'acme', orgName: 'Acme Ltd' }]);
});

test('a block two phones edited apart shows both edits, merged', async () => {
	const v = { blockKey: 'k', mapFeatureKey: null, replacedAt: '', isDeleted: 0, editedByKey: 'p' };
	const rows: Record<string, unknown[]> = {
		blockEntity: [{ blockKey: 'k', createdAt: '2026-11-01', createdByKey: 'p' }],
		blockTable: [
			{ ...v, versionKey: 'b0', blockName: 'North', allocatedQty: 100, createdAt: '2026-11-01', replacesKey: '' },
			{ ...v, versionKey: 'b1', blockName: 'North Ridge', allocatedQty: 100, createdAt: '2026-11-02', replacesKey: 'b0' },
			{ ...v, versionKey: 'b2', blockName: 'North', allocatedQty: 200, createdAt: '2026-11-03', replacesKey: 'b0' },
		],
	};
	await openDatabase(await build(async (path: string) => Response.json(rows[path.split('?')[0]] ?? [])));
	expect(query('SELECT blockName, allocatedQty FROM blockView')).toEqual([{ blockName: 'North Ridge', allocatedQty: 200 }]);
});

test("builds the Phone schema from Central's rows, and the reports read it", async () => {
	// Pages of 100 against 926 tallies: the last short page ends each table.
	await openDatabase(await build(central, 100));
	expect(query('PRAGMA user_version')).toEqual([{ user_version: 57 }]);
	expect(query(perDay)).toEqual(perDayInSample);
	expect(query('SELECT count(*) AS n FROM tallyTable')).toEqual([sample.prepare('SELECT count(*) AS n FROM tallyTable').get()].map((r) => ({ ...r })));
});

/** Ops' IndexedDB cache, holding `kept` by authId: each request answers on the next microtask, as a browser's does. */
function cache(kept: Map<string, unknown>) {
	const answer = <T>(result: T) => {
		const req = { result, onsuccess: null as null | (() => void) };
		queueMicrotask(() => req.onsuccess?.());
		return req;
	};
	const store = { get: (k: string) => answer(kept.get(k)), put: (v: unknown, k: string) => (kept.set(k, v), answer(k)) };
	vi.stubGlobal('indexedDB', { open: () => answer({ transaction: () => ({ objectStore: () => store }), close: () => {} }) });
}
const central2 = (cursor: string) => (path: string) => Response.json(path === 'snapshot' ? [{ superCruddedAt: cursor }] : []);

test("the last copy shows at once; Central's newer one replaces it and is kept for next time", async () => {
	browser(3600, central2('noon'));
	const kept = new Map<string, unknown>([['u1', { cursor: 'dawn', bytes: new Uint8Array([1]) }]]);
	cache(kept);
	const onBytes = vi.fn();
	const stop = follow(onBytes, () => {});
	await settle();
	stop();
	expect(onBytes.mock.calls.map(([bytes, at]) => [bytes.length, at])).toEqual([[1, 'dawn'], [expect.any(Number), 'noon']]);
	expect(kept.get('u1')).toEqual({ cursor: 'noon', bytes: onBytes.mock.calls[1][0] });
	vi.unstubAllGlobals();
	vi.unstubAllEnvs();
});

test('a kept copy Central has not moved past is not rebuilt', async () => {
	browser(3600, central2('dawn'));
	cache(new Map([['u1', { cursor: 'dawn', bytes: new Uint8Array([1]) }]]));
	const onBytes = vi.fn();
	const stop = follow(onBytes, () => {});
	await settle();
	stop();
	expect(onBytes.mock.calls.map(([, at]) => at)).toEqual(['dawn']);
	vi.unstubAllGlobals();
	vi.unstubAllEnvs();
});
