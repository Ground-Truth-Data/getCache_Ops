// Plugins: a form anyone adds to their phone from a link. A plugin is made, edited and copied in this browser with
// no account; Publish alone needs one, and writes the version to Central's ops.plugin, where triggers lock it and
// keep the maker's credit. Answers never go to Central: a phone sends its plugins file, and Ops keeps every row of
// every file it is given, in this browser.
import sqlite3InitModule, { type Database } from '@sqlite.org/sqlite-wasm';
import { session } from '../data/auth';
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

/** This browser's plugins, and the signed-in maker's from anywhere: each one's versions, oldest first. */
export async function myPlugins(authId?: string): Promise<PluginRow[][]> {
	const ids = new Set(Object.keys(kept()));
	if (authId) for (const r of await call<{ pluginId: string }[]>(`plugin?createdBy=eq.${authId}&select=pluginId`)) ids.add(r.pluginId);
	const rows = await published([...ids]);
	return [...ids].map((id) => withDraft(rows.filter((r) => r.pluginId === id), id)).filter((v) => v.length);
}

/** A plugin's newest published version, as a phone adding it would get it. */
export const live = async (pluginId: string) => (await published([pluginId])).at(-1);

/** What a phone opens to add the plugin: the same link is in its QR code. */
export const addLink = (pluginId: string) => `${new URL(appHome).origin}/app/plugin?add=${pluginId}`;

/** The builder's store for one plugin; `meta` is the logo the page is showing. */
export function pluginStore(pluginId: string, meta: () => { logo: string | null }, loaded: (rows: PluginRow[]) => void): Store {
	let id = pluginId === 'new' ? undefined : pluginId;
	return {
		autosave: true,
		async load() {
			const rows = id ? withDraft(await published([id]), id) : [];
			loaded(rows);
			return rows;
		},
		async save(definition: Definition) {
			if (!id) history.replaceState(null, '', `#/plugins/edit/${(id = crypto.randomUUID())}`);
			keep(id, { pluginId: id, definition, ...meta(), copiedFrom: kept()[id]?.copiedFrom ?? null });
		},
		async publish() {
			const d = id && kept()[id];
			if (!d) return;
			if (!session()) throw new SignInNeeded();
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

/** Keeps a sent file's rows; returns how many of each were new. */
export async function receive(bytes: Uint8Array): Promise<Record<string, number>> {
	if (new TextDecoder().decode(bytes.subarray(0, 16)) !== 'SQLite format 3\0') throw new Error("isn't a Get Cache plugins file.");
	const { sqlite3, db } = await answersDb();
	db.exec("ATTACH ':memory:' AS sent");
	try {
		load(sqlite3, db, 'sent', bytes);
		const has = (schema: string) => new Set(rows(db, `SELECT name FROM ${schema}.sqlite_schema WHERE type = 'table'`).map((r) => r.name));
		if (!TABLES.every((t) => has('sent').has(t))) throw new Error("isn't a Get Cache plugins file.");
		const added: Record<string, number> = {};
		db.transaction(() => {
			if (!has('main').size)
				for (const { sql } of rows(db, "SELECT sql FROM sent.sqlite_schema WHERE type IN ('table', 'trigger') AND sql IS NOT NULL ORDER BY type = 'trigger'")) db.exec(sql as string);
			for (const t of TABLES) {
				const cols = rows(db, 'SELECT name FROM pragma_table_info(?, ?)', [t, 'sent']).map((r) => `"${r.name}"`).join(', ');
				db.exec(`INSERT INTO main."${t}" (${cols}) SELECT ${cols} FROM sent."${t}" WHERE true ON CONFLICT DO NOTHING`);
				added[t] = db.changes();
			}
		});
		const out = sqlite3.capi.sqlite3_js_db_export(db, 'main');
		const w = await (await (await navigator.storage.getDirectory()).getFileHandle(KEPT, { create: true })).createWritable();
		await w.write(out as Uint8Array<ArrayBuffer>);
		await w.close();
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
	const answers = json<Answers['answers'][number]>(rows(db, `SELECT id, plugin AS form, filledAt, replaces, data FROM answer WHERE plugin IN (${marks}) ORDER BY filledAt`, ids), 'data');
	const all = json<Answers['rows'][number]>(
		rows(db, `SELECT r.id, r.answer, r.groupKey, r.n, r.replaces, r.data FROM answerRow r JOIN answer a ON a.id = r.answer WHERE a.plugin IN (${marks})`, ids),
		'data',
	);
	const photos = new Map(rows(db, 'SELECT key, type, bytes FROM photo').map((p) => [p.key as string, URL.createObjectURL(new Blob([p.bytes as Uint8Array<ArrayBuffer>], { type: p.type as string }))]));
	return { versions, answers, rows: all, photos };
}
