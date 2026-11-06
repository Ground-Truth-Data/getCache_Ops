// Plugins: a form anyone adds to their phone from a link. A plugin is made, edited and copied in this browser with
// no account; Publish alone needs one, and writes the version to Central's ops.plugin, where triggers lock it and
// keep the maker's credit. Answers never go to Central: a phone sends its plugins file, and Ops keeps every row of
// every file it is given, in this browser.
import sqlite3InitModule, { type Database } from '@sqlite.org/sqlite-wasm';
import { fresh } from '../data/auth';
import { appHome, call } from '../company/central';
import type { Answers, Definition, Store, Version } from './forms';

export type PluginRow = Version & { pluginId: string; madeBy?: string; logo: string | null; copiedFrom: string | null };
type Draft = Pick<PluginRow, 'pluginId' | 'definition' | 'logo' | 'copiedFrom'>;

export class SignInNeeded extends Error {
	constructor() {
		super('Sign in to publish.');
	}
}

const COLS = 'id,pluginId,version,definition,madeBy,logo,publishedAt,copiedFrom';
const published = (ids: string[]) =>
	ids.length ? call<PluginRow[]>(`plugin?pluginId=in.(${ids})&publishedAt=not.is.null&select=${COLS}&order=version`) : Promise.resolve([]);

// Every plugin this browser made or copied, with its unpublished draft, or null once that is published.
const KEY = 'ops-plugins';
const kept = (): Record<string, Draft | null> => JSON.parse(localStorage.getItem(KEY) ?? '{}');
const keep = (pluginId: string, d: Draft | null) => localStorage.setItem(KEY, JSON.stringify({ ...kept(), [pluginId]: d }));

/** Central's published versions, then this browser's draft as the next one. */
function withDraft(rows: PluginRow[], pluginId: string): PluginRow[] {
	const d = kept()[pluginId];
	return d ? [...rows, { ...d, id: 'local', version: (rows.at(-1)?.version ?? 0) + 1, publishedAt: null }] : rows;
}

// A draft lives only in this browser: Central being unreachable or a sign-in expiring must never hide it or stop it
// saving, so Central's half of a read comes back empty, loudly.
const orNone = <T>(p: Promise<T[]>) => p.catch((e): T[] => (console.warn("[plugins] Central unreachable; showing this browser's drafts only", e), []));

/** This browser's plugins, and the signed-in maker's from anywhere: each one's versions, oldest first. */
export async function myPlugins(authId?: string): Promise<PluginRow[][]> {
	const ids = new Set(Object.keys(kept()));
	if (authId) for (const r of await orNone(call<{ pluginId: string }[]>(`plugin?createdBy=eq.${authId}&select=pluginId`))) ids.add(r.pluginId);
	const rows = await orNone(published([...ids]));
	return [...ids].map((id) => withDraft(rows.filter((r) => r.pluginId === id), id)).filter((v) => v.length);
}

/** A plugin's newest published version, as a phone adding it would get it. */
export const live = async (pluginId: string) => (await published([pluginId])).at(-1);

/** What a phone opens to add the plugin: the same link is in its QR code. */
export const addLink = (pluginId: string) => `${new URL(appHome).origin}/app/plugin?add=${pluginId}`;

/** The builder's store for one plugin; `meta` is the logo the page is showing. */
export function pluginStore(pluginId: string, meta: () => { logo: string | null }, loaded: (rows: PluginRow[]) => void): Store {
	const id = pluginId;
	return {
		autosave: true,
		async load() {
			const rows = withDraft(await orNone(published([id])), id);
			loaded(rows);
			return rows;
		},
		async save(definition: Definition) {
			keep(id, { pluginId: id, definition, ...meta(), copiedFrom: kept()[id]?.copiedFrom ?? null });
		},
		async publish() {
			const d = kept()[id];
			if (!d) return;
			if (!(await fresh())) throw new SignInNeeded();
			// An interrupted publish can leave its row unpublished; Central holds one draft per plugin.
			await call(`plugin?pluginId=eq.${id}&publishedAt=is.null`, 'DELETE');
			const { pluginId, definition, logo, copiedFrom } = d;
			const [row] = await call<PluginRow[]>('plugin', 'POST', { pluginId, definition, logo, copiedFrom });
			await call(`plugin?id=eq.${row.id}`, 'PATCH', { publishedAt: new Date().toISOString() });
			keep(d.pluginId, null);
		},
	};
}

/** A new plugin of your own from anyone's published one, made here; Central keeps the original maker's credit. */
export async function copyPlugin(pluginId: string): Promise<string> {
	const src = (await published([pluginId])).at(-1);
	if (!src) throw new Error('No published plugin at that link.');
	const id = crypto.randomUUID();
	keep(id, { pluginId: id, definition: src.definition, logo: src.logo, copiedFrom: src.id });
	return id;
}

// Every sent file's rows, merged into one file in this browser's storage. Rows keep the phone's ids, so a file
// given twice adds nothing; the phone's insert-only triggers come across with its tables.
const KEPT = 'plugin-answers.sqlite3';
const OLDER = 'plugin-answers.older.sqlite3';
const TABLES = ['plugin', 'photo', 'answer', 'answerRow'];
type Sqlite = Awaited<ReturnType<typeof sqlite3InitModule>>;
let opened: Promise<{ sqlite3: Sqlite; db: Database }> | undefined;

function load(sqlite3: Sqlite, db: Database, schema: string, bytes: Uint8Array) {
	const { capi, wasm } = sqlite3;
	const p = wasm.allocFromTypedArray(bytes);
	db.checkRc(capi.sqlite3_deserialize(db.pointer!, schema, p, bytes.byteLength, bytes.byteLength, capi.SQLITE_DESERIALIZE_FREEONCLOSE | capi.SQLITE_DESERIALIZE_RESIZEABLE));
}

const answersDb = () =>
	(opened ??= (async () => {
		const sqlite3 = await sqlite3InitModule();
		const db = new sqlite3.oo1.DB();
		const file = await (await navigator.storage.getDirectory()).getFileHandle(KEPT).then((h) => h.getFile(), () => null);
		if (file) load(sqlite3, db, 'main', new Uint8Array(await file.arrayBuffer()));
		return { sqlite3, db };
	})());

const rows = (db: Database, sql: string, bind: unknown[] = []) => db.exec({ sql, bind: bind as never, rowMode: 'object', returnValue: 'resultRows' });

const save = async (name: string, bytes: Uint8Array) => {
	const w = await (await (await navigator.storage.getDirectory()).getFileHandle(name, { create: true })).createWritable();
	await w.write(bytes as Uint8Array<ArrayBuffer>);
	await w.close();
};
const columns = (db: Database, schema: string, t: string) => rows(db, 'SELECT name FROM pragma_table_info(?, ?)', [t, schema]).map((r) => r.name as string);

// A kept file older than a sent one is never altered (rapper/DB_LAW.md law 1): it is kept aside, and a fresh file
// from the sent schema takes its rows. A row the fresh file refuses (an answer from before editedByKey) stays aside.
async function renew(sqlite3: Sqlite, old: Database, schema: string[]) {
	const older = sqlite3.capi.sqlite3_js_db_export(old, 'main');
	await save(OLDER, older);
	old.close();
	const db = new sqlite3.oo1.DB();
	for (const sql of schema) db.exec(sql);
	db.exec("ATTACH ':memory:' AS old");
	load(sqlite3, db, 'old', older);
	const refused = TABLES.flatMap((t) => {
		const cols = columns(db, 'old', t).filter((c) => columns(db, 'main', t).includes(c)).map((c) => `"${c}"`).join(', ');
		db.exec(`INSERT OR IGNORE INTO main."${t}" (${cols}) SELECT ${cols} FROM old."${t}"`);
		const n = (db.selectValue(`SELECT count(*) FROM old."${t}"`) as number) - db.changes();
		return n ? [`${n} ${t}`] : [];
	});
	db.exec('DETACH old');
	if (refused.length) console.warn(`[plugins] ${refused.join(', ')} the fresh kept file refused; still in`, OLDER);
	return db;
}

/** Keeps a sent file's rows; returns how many of each were new. */
export async function receive(bytes: Uint8Array): Promise<Record<string, number>> {
	if (new TextDecoder().decode(bytes.subarray(0, 16)) !== 'SQLite format 3\0') throw new Error("isn't a Get Cache plugins file.");
	let { sqlite3, db } = await answersDb();
	const attach = () => (db.exec("ATTACH ':memory:' AS sent"), load(sqlite3, db, 'sent', bytes));
	attach();
	try {
		const has = (schema: string) => new Set(rows(db, `SELECT name FROM ${schema}.sqlite_schema WHERE type = 'table'`).map((r) => r.name));
		if (!TABLES.every((t) => has('sent').has(t))) throw new Error("isn't a Get Cache plugins file.");
		const schema = rows(db, "SELECT sql FROM sent.sqlite_schema WHERE type IN ('table', 'trigger') AND sql IS NOT NULL ORDER BY type = 'trigger'").map((r) => r.sql as string);
		if (has('main').size && TABLES.some((t) => columns(db, 'sent', t).some((c) => !columns(db, 'main', t).includes(c)))) {
			db = await renew(sqlite3, db, schema);
			opened = Promise.resolve({ sqlite3, db });
			attach();
		}
		const added: Record<string, number> = {};
		db.transaction(() => {
			if (!has('main').size) for (const sql of schema) db.exec(sql);
			for (const t of TABLES) {
				const cols = columns(db, 'sent', t).map((c) => `"${c}"`).join(', ');
				db.exec(`INSERT INTO main."${t}" (${cols}) SELECT ${cols} FROM sent."${t}" WHERE true ON CONFLICT DO NOTHING`);
				added[t] = db.changes();
			}
		});
		await save(KEPT, sqlite3.capi.sqlite3_js_db_export(db, 'main'));
		return added;
	} finally {
		db.exec('DETACH sent');
	}
}

/** Each plugin any sent file held, its newest version's title and credit, and how many answers came in. */
export async function received(): Promise<{ pluginId: string; title: string; madeBy: string; answers: number }[]> {
	const { db } = await answersDb();
	if (!rows(db, "SELECT 1 FROM sqlite_schema WHERE name = 'plugin'").length) return [];
	return rows(
		db,
		`SELECT p.pluginId, json_extract(p.definition, '$.title') AS title, p.madeBy,
			(SELECT count(*) FROM answer a JOIN plugin v ON v.id = a.plugin WHERE v.pluginId = p.pluginId) AS answers
		FROM plugin p WHERE p.version = (SELECT max(version) FROM plugin WHERE pluginId = p.pluginId) ORDER BY title`,
	) as never;
}

/** One plugin's answers, every version, and its photos as object URLs keyed as the answers name them. */
export async function receivedAnswers(pluginId: string): Promise<Answers & { photos: Map<string, string> }> {
	const { db } = await answersDb();
	const json = <T>(list: Record<string, unknown>[], key: string) => list.map((r) => ({ ...r, [key]: JSON.parse(r[key] as string) }) as T);
	const versions = json<Version>(rows(db, 'SELECT id, version, definition, publishedAt FROM plugin WHERE pluginId = ? ORDER BY version', [pluginId]), 'definition');
	const ids = versions.map((v) => v.id);
	const marks = ids.map(() => '?').join(', ');
	const answers = json<Answers['answers'][number]>(rows(db, `SELECT id, plugin AS form, filledAt, replaces, data, lat, lng, accuracyM FROM answer WHERE plugin IN (${marks}) ORDER BY filledAt`, ids), 'data');
	const all = json<Answers['rows'][number]>(
		rows(db, `SELECT r.id, r.answer, r.groupKey, r.n, r.replaces, r.data, r.lat, r.lng, r.accuracyM FROM answerRow r JOIN answer a ON a.id = r.answer WHERE a.plugin IN (${marks})`, ids),
		'data',
	);
	const photos = new Map(rows(db, 'SELECT key, type, bytes FROM photo').map((p) => [p.key as string, URL.createObjectURL(new Blob([p.bytes as Uint8Array<ArrayBuffer>], { type: p.type as string }))]));
	return { versions, answers, rows: all, photos };
}
