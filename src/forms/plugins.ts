// Plugins: a form anyone adds to their phone from a link. A plugin lives only in Central's ops.plugin, so making
// one needs a sign-in: its first save makes the row. Its maker edits it there in place until two people other
// than the maker have sent answers; from then on Central refuses every edit, and the way on is a new form made from
// it. Answers never go to Central: a phone sends its plugins file, and Ops keeps every row of every file it is
// given, and every form filled here, in this browser.
import sqlite3InitModule, { type Database } from '@sqlite.org/sqlite-wasm';
import { refused, split } from '../../_rapper/gc/form';
import { pluginsDdl } from '../../_rapper/gc/pluginsFile';
import { fresh } from '../data/auth';
import { appHome, call } from '../company/central';
import type { Answers, Definition, Form, Store } from './forms';

/** `orgKey`: the company that publishes it; null for a person's own. `company`: Central's card for it. */
export type PluginRow = Form & {
	madeBy?: string;
	createdAt?: string;
	logo: string | null;
	copiedFrom: string | null;
	orgKey: string | null;
	droppedAt?: string | null;
	company?: { orgKey: string; name: string; color: string | null; logo: string | null } | null;
	/** When the signed-in person retired it; null for everyone else. */
	retiredAt?: string | null;
};

export class SignInNeeded extends Error {
	constructor() {
		super('Sign in to save.');
	}
}

const COLS = '*,lockedAt,replacedBy,retiredAt,company';
const central = (filter: string) => call<PluginRow[]>(`plugin?${filter}&select=${COLS}`);
/** Central's rows for these plugins, as a phone adding them would get them. */
export const plugins = (ids: string[]) => (ids.length ? central(`id=in.(${ids})`) : Promise.resolve([]));

/** The signed-in maker's plugins, from Central only: nothing about a plugin is kept in the browser. */
export const myPlugins = async (authId?: string): Promise<PluginRow[]> => (authId ? central(`createdBy=eq.${authId}&order=createdAt.desc`) : []);

// Central answers a write it refused under row-level security with no rows, so "Saved." waits for the row itself.
async function written(rows: Promise<PluginRow[]>): Promise<PluginRow> {
	const [row] = await rows;
	if (!row) throw new Error('Central did not save this plugin.');
	return row;
}

export const live = async (id: string) => (await central(`id=eq.${id}`))[0];

/** Greys a plugin and sinks it in the signed-in person's own list only; it still opens. */
export async function retirePlugin(id: string): Promise<void> {
	if (!(await fresh())) throw new SignInNeeded();
	const [row] = await call<unknown[]>('pluginRetired', 'POST', { plugin: id });
	if (!row) throw new Error('Central did not retire this plugin.');
}
/** Every plugin a company published, newest first: its suite. */
export const companyPlugins = (orgKey: string) => central(`orgKey=eq.${orgKey}&order=publishedAt.desc`);

/** What a phone opens to add the plugin: the same link is in its QR code. */
export const addLink = (id: string) => `${new URL(appHome).origin}/app/plugin?add=${id}`;

/** The builder's store for one plugin; `meta` is the logo the page is showing and the company it publishes as. */
export function pluginStore(id: string, meta: () => { logo: string | null; orgKey?: string | null }, loaded: (row: PluginRow | undefined) => void): Store {
	let row: PluginRow | undefined;
	return {
		autosave: true,
		async load() {
			loaded((row = await live(id)));
			return row;
		},
		// A plugin's first save makes its row on Central; every later one rewrites that row in place.
		async save(definition: Definition) {
			if (!(await fresh())) throw new SignInNeeded();
			const { logo, orgKey } = meta();
			row = await written(
				row
					? call(`plugin?id=eq.${id}`, 'PATCH', { definition, logo })
					: call('plugin', 'POST', { id, definition, logo, ...(orgKey && { orgKey }) }),
			);
		},
		publish: async () => {},
		copy: () => copyPlugin(id),
	};
}

/** A new, open plugin of your own from anyone's published one; Central keeps the original maker's credit. */
export async function copyPlugin(source: string): Promise<string> {
	const src = await live(source);
	if (!src) throw new Error('No published plugin at that link.');
	if (!(await fresh())) throw new SignInNeeded();
	const id = crypto.randomUUID();
	await written(call('plugin', 'POST', { id, definition: src.definition, logo: src.logo, copiedFrom: src.id }));
	return id;
}

// Every sent file's rows, merged into one file in this browser's storage. Rows keep the phone's ids, so a file
// given twice adds nothing; the phone's insert-only triggers come across with its tables.
const KEPT = 'plugin-answers.sqlite3';
// Each set-aside file is named for when it was set aside, so a later one never overwrites it.
const older = () => `plugin-answers.older-${new Date().toISOString().replaceAll(':', '')}.sqlite3`;
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
	const aside = older();
	const bytes = sqlite3.capi.sqlite3_js_db_export(old, 'main');
	await save(aside, bytes);
	old.close();
	const db = new sqlite3.oo1.DB();
	for (const sql of schema) db.exec(sql);
	db.exec("ATTACH ':memory:' AS old");
	load(sqlite3, db, 'old', bytes);
	const refused = TABLES.flatMap((t) => {
		const cols = columns(db, 'old', t).filter((c) => columns(db, 'main', t).includes(c)).map((c) => `"${c}"`).join(', ');
		db.exec(`INSERT OR IGNORE INTO main."${t}" (${cols}) SELECT ${cols} FROM old."${t}"`);
		const n = (db.selectValue(`SELECT count(*) FROM old."${t}"`) as number) - db.changes();
		return n ? [`${n} ${t}`] : [];
	});
	db.exec('DETACH old');
	if (refused.length) console.warn(`[plugins] ${refused.join(', ')} the fresh kept file refused; still in`, aside);
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

/** A form filled here, kept as a phone keeps one, beside every sent file's answers; `by` signs it. */
export async function keepAnswer(v: PluginRow, answers: Record<string, unknown>, photos: Map<string, File>, by: string): Promise<void> {
	const { data, fix, rows: entries } = split(v.definition, answers);
	const why = refused(v.definition, data) ?? entries.map((r) => refused(v.definition, r.data, r.groupKey)).find(Boolean);
	if (why) throw new Error(why);
	const { sqlite3, db } = await answersDb();
	const now = new Date().toISOString();
	const at = (f: typeof fix) => [f?.lat ?? null, f?.lng ?? null, f?.accuracyM ?? null];
	const pictures = await Promise.all([...photos].map(async ([key, f]) => [key, f.type, new Uint8Array(await f.arrayBuffer()), now]));
	const id = crypto.randomUUID();
	db.transaction(() => {
		if (!rows(db, "SELECT 1 FROM sqlite_schema WHERE name = 'plugin'").length) for (const sql of pluginsDdl.split('--> statement-breakpoint')) db.exec(sql);
		db.exec({
			sql: 'INSERT INTO plugin (id, definition, madeBy, logo, publishedAt, addedAt) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING',
			bind: [v.id, JSON.stringify(v.definition), v.madeBy!, v.logo, v.publishedAt!, now],
		});
		for (const p of pictures) db.exec({ sql: 'INSERT INTO photo (key, type, bytes, takenAt) VALUES (?, ?, ?, ?)', bind: p as never });
		db.exec({
			sql: 'INSERT INTO answer (id, plugin, filledAt, data, editedByKey, lat, lng, accuracyM) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
			bind: [id, v.id, now, JSON.stringify(data), by, ...at(fix)] as never,
		});
		for (const r of entries)
			db.exec({
				sql: 'INSERT INTO answerRow (id, answer, groupKey, n, data, lat, lng, accuracyM) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
				bind: [crypto.randomUUID(), id, r.groupKey, r.n, JSON.stringify(r.data), ...at(r.fix)] as never,
			});
	});
	await save(KEPT, sqlite3.capi.sqlite3_js_db_export(db, 'main'));
	if (await fresh()) await call('pluginReceipt', 'POST', { answer: id, plugin: v.id });
}

/** How many answers each plugin has in the sent files and fills kept here, and when the last was filled. */
export async function received(): Promise<{ id: string; answers: number; lastAt: string }[]> {
	const { db } = await answersDb();
	if (!rows(db, "SELECT 1 FROM sqlite_schema WHERE name = 'plugin'").length) return [];
	return rows(
		db,
		`SELECT plugin AS id, count(*) FILTER (WHERE id NOT IN (SELECT replaces FROM answer WHERE replaces IS NOT NULL)) AS answers, max(filledAt) AS lastAt
		FROM answer GROUP BY plugin`,
	) as never;
}

/** One plugin's answers, read through its form as it is now, and its photos as object URLs keyed as the answers name them. */
export async function receivedAnswers(id: string, definition: Definition): Promise<Answers & { photos: Map<string, string> }> {
	const { db } = await answersDb();
	const json = <T>(list: Record<string, unknown>[]) => list.map((r) => ({ ...r, data: JSON.parse(r.data as string) }) as T);
	const answers = json<Answers['answers'][number]>(rows(db, `SELECT id, plugin AS form, filledAt, replaces, data, editedByKey, lat, lng, accuracyM FROM answer WHERE plugin = ? ORDER BY filledAt`, [id]));
	const all = json<Answers['rows'][number]>(
		rows(db, 'SELECT r.id, r.answer, r.groupKey, r.n, r.replaces, r.data, r.lat, r.lng, r.accuracyM FROM answerRow r JOIN answer a ON a.id = r.answer WHERE a.plugin = ?', [id]),
	);
	const photos = new Map(rows(db, 'SELECT key, type, bytes FROM photo').map((p) => [p.key as string, URL.createObjectURL(new Blob([p.bytes as Uint8Array<ArrayBuffer>], { type: p.type as string }))]));
	return { definition, answers, rows: all, photos };
}
