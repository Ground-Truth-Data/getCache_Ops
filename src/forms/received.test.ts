import sqlite3InitModule from '@sqlite.org/sqlite-wasm';
import { expect, test, vi } from 'vitest';
import { disk } from './fakeDisk';

const { receive, receivedAnswers } = await import('./plugins');
const sqlite3 = await sqlite3InitModule();

const PLUGIN = 'CREATE TABLE plugin (id text PRIMARY KEY NOT NULL, definition text NOT NULL, madeBy text NOT NULL, logo text, publishedAt text NOT NULL, addedAt text NOT NULL)';
const PHOTO = 'CREATE TABLE photo (key text PRIMARY KEY NOT NULL, type text NOT NULL, bytes blob NOT NULL, takenAt text NOT NULL)';
const FIX = 'lat real, lng real, accuracyM real';
const file = (ddl: string[], rows: string[]) => {
	const db = new sqlite3.oo1.DB();
	for (const s of [...ddl, ...rows]) db.exec(s);
	const bytes = sqlite3.capi.sqlite3_js_db_export(db);
	db.close();
	return bytes;
};
const v1 = `INSERT INTO plugin VALUES ('p', '{"title":"Trees","elements":[]}', 'Chris', NULL, '2026-11-01', '2026-11-01')`;

test('a kept file from before the location columns is replaced by a fresh one; its rows come across or are kept aside', async () => {
	disk.set(
		'plugin-answers.sqlite3',
		file(
			[PLUGIN, PHOTO, 'CREATE TABLE answer (id text PRIMARY KEY NOT NULL, plugin text NOT NULL, filledAt text NOT NULL, replaces text, data text NOT NULL)',
				'CREATE TABLE answerRow (id text PRIMARY KEY NOT NULL, answer text NOT NULL, groupKey text NOT NULL, n integer NOT NULL, replaces text, data text NOT NULL)'],
			[v1, `INSERT INTO answer VALUES ('old', 'p', '2026-11-02', NULL, '{}')`, `INSERT INTO answerRow VALUES ('oldRow', 'old', 'tree', 1, NULL, '{}')`],
		),
	);
	const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
	vi.useFakeTimers({ toFake: ['Date'] });
	vi.setSystemTime(new Date('2026-11-05T12:00:00Z'));
	const answer = `CREATE TABLE answer (id text PRIMARY KEY NOT NULL, plugin text NOT NULL, filledAt text NOT NULL, replaces text, data text NOT NULL, editedByKey text NOT NULL, ${FIX}`;
	const answerRow = `CREATE TABLE answerRow (id text PRIMARY KEY NOT NULL, answer text NOT NULL, groupKey text NOT NULL, n integer NOT NULL, replaces text, data text NOT NULL, ${FIX})`;
	await receive(
		file(
			[PLUGIN, PHOTO, `${answer})`, answerRow],
			[v1, `INSERT INTO answer VALUES ('new', 'p', '2026-11-05', NULL, '{}', 'me', 49.25, -123.1, 5)`, `INSERT INTO answerRow VALUES ('newRow', 'new', 'tree', 1, NULL, '{}', 49.2511, -123.1011, 4)`],
		),
	);
	const got = await receivedAnswers('p', { title: 'Trees', elements: [] });
	expect(got.answers.map((a) => [a.id, a.lat])).toEqual([['new', 49.25]]);
	expect(got.rows.map((r) => [r.id, r.lat])).toEqual([['newRow', 49.2511]]);
	// The old answer has no editedByKey, which the fresh file refuses: it waits in the older file, never dropped.
	const older = new sqlite3.oo1.DB();
	const bytes = disk.get('plugin-answers.older-2026-11-05T120000.000Z.sqlite3')!;
	const p = sqlite3.wasm.allocFromTypedArray(bytes);
	older.checkRc(sqlite3.capi.sqlite3_deserialize(older.pointer!, 'main', p, bytes.byteLength, bytes.byteLength, sqlite3.capi.SQLITE_DESERIALIZE_FREEONCLOSE));
	expect(older.selectValues('SELECT id FROM answer')).toEqual(['old']);
	expect(warn).toHaveBeenCalledWith(expect.stringContaining('1 answer'), expect.anything());

	vi.setSystemTime(new Date('2026-11-06T12:00:00Z'));
	await receive(file([PLUGIN, PHOTO, `${answer}, note text)`, answerRow], [v1]));
	expect([...disk.keys()].filter((k) => k.startsWith('plugin-answers.older-'))).toHaveLength(2);
	vi.useRealTimers();
});
