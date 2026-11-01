import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { beforeAll, expect, test } from 'vitest';
import { describe as describeTable, listTables, openDatabase, query } from './db';

const sample = readFileSync(new URL('../../public/sample.sqlite', import.meta.url));

beforeAll(async () => {
	await openDatabase(sample);
});

test('listTables names the Get Cache tables', () => {
	expect(listTables()).toEqual(expect.arrayContaining(['tallyTable', 'bagUpTable', 'blockTable', 'qaPlotTable']));
});

test('describe returns each column with its type', () => {
	expect(describeTable('tallyTable')).toContainEqual({ name: 'plantedQty', type: 'REAL', notNull: true, primaryKey: false });
	expect(describeTable('tallyTable')[0]).toMatchObject({ name: 'versionKey', primaryKey: true });
});

test('opens a Get Cache backup: the database gzipped in a JSON envelope', async () => {
	const envelope = (e: object) => new TextEncoder().encode(JSON.stringify({ version: 1, kind: 'backup', payload: gzipSync(sample).toString('base64'), ...e }));
	await openDatabase(envelope({ encrypted: false }));
	expect(query('PRAGMA user_version')).toEqual([{ user_version: 57 }]);
	await expect(openDatabase(envelope({ encrypted: true }))).rejects.toThrow('is an older encrypted backup: ask the planter to make a new one');
	await expect(openDatabase(envelope({ kind: 'map' }))).rejects.toThrow('not a backup');
});

test('a file that is not SQLite is refused, and the open one stays open', async () => {
	await expect(openDatabase(new TextEncoder().encode('just some notes'))).rejects.toThrow("isn't a Get Cache file");
	expect(query('PRAGMA user_version')).toEqual([{ user_version: 57 }]);
});

test('query returns row objects', () => {
	expect(query('PRAGMA user_version')).toEqual([{ user_version: 57 }]);
	const [day] = query('SELECT plantedDt, count(*) AS bagUps FROM bagUpView GROUP BY plantedDt ORDER BY plantedDt LIMIT 1');
	expect(day).toEqual({ plantedDt: '2026-05-04', bagUps: expect.any(Number) });
});
