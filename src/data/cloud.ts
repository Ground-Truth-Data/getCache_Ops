// The signed-in planter's rows, read from Central (Postgres schema getCacheMobile) with
// their own token: SELECT only, row-level security decides what comes back. Nothing here
// signs out or writes. Contract: getCache/src/lib/docs/OPS_READ.md.

import sqlite3InitModule from '@sqlite.org/sqlite-wasm';
import ddl from '../../schema/v57.sql?raw';
import { fresh, session } from './auth';

const env = import.meta.env;
const EVERY_MS = 30_000;

/** Who Get Cache is signed in as in this browser, with a token still good, or null. */
export function signedIn(): { authId: string; email: string } | null {
	const s = session();
	return s?.user?.id ? { authId: s.user.id, email: s.user.email ?? '' } : null;
}

async function rest(path: string, range?: string): Promise<Response> {
	const s = await fresh();
	if (!s) throw new Error('signed out of Get Cache');
	const res = await fetch(`${env.PUBLIC_GC_RT_supabase_address}/rest/v1/${path}`, {
		headers: {
			apikey: env.PUBLIC_GC_RT_supabase_key,
			authorization: `Bearer ${s.access_token}`,
			'accept-profile': 'getCacheMobile',
			...(range ? { range } : {}),
		},
	});
	if (res.status === 401) throw new Error('your sign-in has expired: sign in to Get Cache again');
	return res;
}

/** When Central last took a phone upload for this account: it moves exactly when the rows do. */
async function cursor(): Promise<string> {
	const res = await rest('snapshot?select=superCruddedAt&status=eq.success&order=superCruddedAt.desc&limit=1');
	if (!res.ok) throw new Error(`Central: HTTP ${res.status}`);
	return (await res.json())[0]?.superCruddedAt ?? '';
}

/** Every Central row this planter may read, in the Phone schema the reports query. */
export async function build(read = rest, page = 1000): Promise<Uint8Array> {
	const sqlite3 = await sqlite3InitModule();
	const db = new sqlite3.oo1.DB();
	try {
		db.exec(ddl);
		// The schema the DDL file is, as a phone stamps its own file: the reports check it.
		db.exec('PRAGMA user_version = 57');
		db.exec('PRAGMA foreign_keys = OFF');
		const tables = db.exec({ sql: "SELECT name FROM sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite_%'", rowMode: 'array', returnValue: 'resultRows' }).map((r) => String(r[0]));
		for (const table of tables) {
			const cols = db.exec({ sql: 'SELECT name FROM pragma_table_info(?)', bind: [table], rowMode: 'array', returnValue: 'resultRows' }).map((r) => String(r[0]));
			const insert = db.prepare(`INSERT INTO "${table}" (${cols.map((c) => `"${c}"`).join(',')}) VALUES (${cols.map(() => '?').join(',')})`);
			try {
				for (let from = 0; ; from += page) {
					const res = await read(`${table}?select=${cols.map(encodeURIComponent).join(',')}`, `${from}-${from + page - 1}`);
					// Ops' schema runs ahead of prod Central (editNoteTable, Nov 2026): a table not migrated there yet reads as empty.
					if (res.status === 404) {
						console.warn(`[ops] Central has no ${table}`);
						break;
					}
					if (!res.ok) throw new Error(`Central ${table}: HTTP ${res.status}`);
					const rows: Record<string, unknown>[] = await res.json();
					for (const row of rows)
						insert.bind(cols.map((c) => (row[c] !== null && typeof row[c] === 'object' ? JSON.stringify(row[c]) : row[c]) as never)).stepReset();
					if (rows.length < page) break;
				}
			} finally {
				insert.finalize();
			}
		}
		return sqlite3.capi.sqlite3_js_db_export(db.pointer!);
	} finally {
		db.close();
	}
}

type Copy = { cursor: string; bytes: Uint8Array };

// Ops' own cache, never Get Cache's database. Get Cache's sign-out wipe deletes it with the rest.
const idb = <T>(run: (s: IDBObjectStore) => IDBRequest<T>, mode: IDBTransactionMode = 'readonly') =>
	new Promise<T>((done, fail) => {
		const open = indexedDB.open('getcache-ops', 1);
		open.onupgradeneeded = () => open.result.createObjectStore('copy');
		open.onerror = () => fail(open.error);
		open.onsuccess = () => {
			const req = run(open.result.transaction('copy', mode).objectStore('copy'));
			req.onsuccess = () => (done(req.result), open.result.close());
			req.onerror = () => fail(req.error);
		};
	});

/** Hands over the cached copy, then a fresh one whenever Central takes a phone upload: checked
 *  now, on focus, and every 30 s while visible. `at` is when Central took it. Calls `onOut` and
 *  stops when the token lapses, or when the first pull fails with nothing to show: the page
 *  lands on data or on signed out, never on a wait. */
export function follow(onBytes: (bytes: Uint8Array, at: string) => void, onOut: () => void): () => void {
	const who = signedIn();
	if (!who) return (onOut(), () => {});
	let seen: string | undefined;
	let busy = false;
	const show = (bytes: Uint8Array, at: string) => ((seen = at), onBytes(bytes, at));
	const check = async () => {
		if (busy || document.hidden) return;
		busy = true;
		try {
			const at = await cursor();
			if (at !== seen) {
				const bytes = await build();
				show(bytes, at);
				await idb((s) => s.put({ cursor: at, bytes }, who.authId), 'readwrite').catch((e) => console.warn('[ops] copy not cached', e));
			}
		} catch (e) {
			console.warn('[ops] pull failed', e);
			if (seen === undefined || !signedIn()) (stop(), onOut());
		} finally {
			busy = false;
		}
	};
	// Not chained before the pull: a cache that never answers must not hold the page.
	idb<Copy | undefined>((s) => s.get(who.authId))
		.then((cached) => cached && seen === undefined && show(cached.bytes, cached.cursor))
		.catch((e) => console.warn('[ops] cached copy unreadable', e));
	check();
	const timer = setInterval(check, EVERY_MS);
	addEventListener('visibilitychange', check);
	const stop = () => (clearInterval(timer), removeEventListener('visibilitychange', check));
	return stop;
}
