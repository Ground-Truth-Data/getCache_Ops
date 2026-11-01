import sqlite3InitModule, { type Database } from '@sqlite.org/sqlite-wasm';

export type Column = { name: string; type: string; notNull: boolean; primaryKey: boolean };

let db: Database | undefined;

/** A planter's Account → Backup file: a JSON envelope whose payload is the whole
 *  database, gzipped, then AES-GCM sealed with Get Cache's shared app key. */
async function unwrapBackup(text: string): Promise<Uint8Array> {
	const { kind, payload } = JSON.parse(text);
	if (kind !== 'backup') throw new Error(`is a ${kind} file, not a backup: ask the planter for Account → Backup.`);
	const hex = import.meta.env.PUBLIC_SHARED_ENCRYPT_KEY;
	if (!hex) throw new Error("can't be opened: this Ops has no PUBLIC_SHARED_ENCRYPT_KEY.");
	const key = await crypto.subtle.importKey('raw', Uint8Array.from(hex.match(/../g), (h: string) => parseInt(h, 16)), 'AES-GCM', false, ['decrypt']);
	const sealed = Uint8Array.from(atob(payload), (c) => c.charCodeAt(0));
	const zipped = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: sealed.subarray(0, 12) }, key, sealed.subarray(12));
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
	db.exec('PRAGMA query_only = 1');
}

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
