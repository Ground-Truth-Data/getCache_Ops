import sqlite3InitModule, { type Database } from '@sqlite.org/sqlite-wasm';

export type Column = { name: string; type: string; notNull: boolean; primaryKey: boolean };

let db: Database | undefined;

/** Loads a SQLite file's bytes into memory, replacing any open database. */
export async function openDatabase(data: ArrayBuffer | Uint8Array): Promise<void> {
	// A Node Buffer is a Uint8Array subclass that allocFromTypedArray rejects; copy to a plain one.
	const bytes = new Uint8Array(data);
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
