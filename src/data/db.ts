import sqlite3InitModule, { type Database } from '@sqlite.org/sqlite-wasm';
import { rebuildDerived } from '../../schema/derive';

export type Column = { name: string; type: string; notNull: boolean; primaryKey: boolean };

let db: Database | undefined;

/** A planter's Account → Backup file: a JSON envelope whose payload is the whole database, gzipped. */
async function unwrapBackup(text: string): Promise<Uint8Array> {
	const { kind, encrypted, payload } = JSON.parse(text);
	if (kind !== 'backup') throw new Error(`is a ${kind} file, not a backup: ask the planter for Account → Backup.`);
	if (encrypted) throw new Error('is an older encrypted backup: ask the planter to make a new one (Account → Backup).');
	const zipped = Uint8Array.from(atob(payload), (c) => c.charCodeAt(0));
	return new Uint8Array(await new Response(new Blob([zipped]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
}

/** Loads a SQLite file, or a Get Cache backup, into memory, replacing any open database. */
export async function openDatabase(data: ArrayBuffer | Uint8Array): Promise<void> {
	// A Node Buffer is a Uint8Array subclass that allocFromTypedArray rejects; copy to a plain one.
	let bytes = new Uint8Array(data);
	if (bytes[0] === 0x7b /* { */) bytes = await unwrapBackup(new TextDecoder().decode(bytes));
	if (new TextDecoder().decode(bytes.subarray(0, 16)) !== 'SQLite format 3\0') throw new Error("isn't a Get Cache file.");
	const sqlite3 = await sqlite3InitModule();
	const { capi, wasm } = sqlite3;
	db?.close();
	db = new sqlite3.oo1.DB();
	const p = wasm.allocFromTypedArray(bytes);
	db.checkRc(
		capi.sqlite3_deserialize(
			db.pointer!,
			'main',
			p,
			bytes.byteLength,
			bytes.byteLength,
			capi.SQLITE_DESERIALIZE_FREEONCLOSE | capi.SQLITE_DESERIALIZE_RESIZEABLE,
		),
	);
	await derive(db);
	db.exec('PRAGMA query_only = 1');
}

/** Every `*View` table refilled from the log by the phone's own rule, so a fork shows its merged row. */
async function derive(d: Database): Promise<void> {
	const rows = (sql: string) => d.exec({ sql, rowMode: 'object', returnValue: 'resultRows' });
	const live = await rebuildDerived((t) => rows(`SELECT * FROM "${t}" ORDER BY rowid`));
	d.transaction(() => {
		for (const [table, got] of Object.entries(live)) {
			const cols = rows(`SELECT name FROM pragma_table_info('${table}')`).map((r) => r.name as string);
			d.exec(`DELETE FROM "${table}"`);
			const put = d.prepare(`INSERT INTO "${table}" (${cols.map((c) => `"${c}"`).join(',')}) VALUES (${cols.map(() => '?').join(',')})`);
			try {
				for (const r of got) put.bind(cols.map((c) => (r[c] ?? null) as never)).stepReset();
			} finally {
				put.finalize();
			}
		}
	});
}

export const isOpen = () => !!db;

/** The open file, read-only, as every built-in page reads it. */
export type Ops = { query: typeof query };

export function query(sql: string, bind?: unknown[]): Record<string, unknown>[] {
	if (!db) throw new Error('No database open');
	return db.exec({ sql, bind: bind as never, rowMode: 'object', returnValue: 'resultRows' });
}

export function listTables(): string[] {
	return query(
		"SELECT name FROM sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
	).map((r) => r.name as string);
}

export function describe(table: string): Column[] {
	return query('SELECT name, type, "notnull", pk FROM pragma_table_info(?)', [table]).map((r) => ({
		name: r.name as string,
		type: r.type as string,
		notNull: r.notnull === 1,
		primaryKey: (r.pk as number) > 0,
	}));
}
