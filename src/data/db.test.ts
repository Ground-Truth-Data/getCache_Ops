import { readFileSync } from 'node:fs';
import { beforeAll, expect, test } from 'vitest';
import { describe as describeTable, listTables, openDatabase, query } from './db';

beforeAll(async () => {
	await openDatabase(readFileSync(new URL('../../public/sample.sqlite', import.meta.url)));
});

test('listTables names the Get Cache tables', () => {
	expect(listTables()).toEqual(expect.arrayContaining(['tallyTable', 'bagUpTable', 'blockTable', 'qaPlotTable']));
});

test('describe returns each column with its type', () => {
	expect(describeTable('tallyTable')).toContainEqual({ name: 'plantedQty', type: 'REAL', notNull: true, primaryKey: false });
	expect(describeTable('tallyTable')[0]).toMatchObject({ name: 'versionKey', primaryKey: true });
});

test('query returns row objects', () => {
	expect(query('PRAGMA user_version')).toEqual([{ user_version: 57 }]);
	const [day] = query('SELECT plantedDt, count(*) AS bagUps FROM bagUpView GROUP BY plantedDt ORDER BY plantedDt LIMIT 1');
	expect(day).toEqual({ plantedDt: '2026-05-04', bagUps: expect.any(Number) });
});
