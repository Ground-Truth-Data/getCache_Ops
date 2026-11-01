import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { beforeAll, expect, test, vi } from 'vitest';
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

test('opens a Get Cache backup: gzipped, sealed, wrapped in JSON', async () => {
	const hex = Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, '0')).join('');
	vi.stubEnv('PUBLIC_SHARED_ENCRYPT_KEY', hex);
	const key = await crypto.subtle.importKey('raw', Buffer.from(hex, 'hex'), 'AES-GCM', false, ['encrypt']);
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const sealed = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, gzipSync(sample));
	const payload = Buffer.concat([iv, new Uint8Array(sealed)]).toString('base64');
	await openDatabase(new TextEncoder().encode(JSON.stringify({ version: 1, kind: 'backup', encrypted: true, payload })));
	expect(query('PRAGMA user_version')).toEqual([{ user_version: 57 }]);
	await expect(openDatabase(new TextEncoder().encode('{"kind":"map","payload":""}'))).rejects.toThrow('not a backup');
	await openDatabase(sample);
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
