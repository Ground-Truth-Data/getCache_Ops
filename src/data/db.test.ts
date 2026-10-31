import { readFileSync } from 'node:fs';
import { beforeAll, expect, test } from 'vitest';
import { describe as describeTable, listTables, openDatabase, query } from './db';

beforeAll(async () => {
	await openDatabase(readFileSync(new URL('../../public/sample.sqlite', import.meta.url)));
});

test('listTables names every user table', () => {
	expect(listTables()).toEqual(['tree']);
});

test('describe returns each column with its type', () => {
	expect(describeTable('tree')).toEqual([
		{ name: 'id', type: 'INTEGER', notNull: false, primaryKey: true },
		{ name: 'species', type: 'TEXT', notNull: true, primaryKey: false },
		{ name: 'planted', type: 'TEXT', notNull: false, primaryKey: false },
	]);
});

test('query returns row objects', () => {
	expect(query('SELECT species FROM tree ORDER BY id')).toEqual([
		{ species: 'Pinus contorta' },
		{ species: 'Picea glauca' },
	]);
});
