import sqlite3InitModule from '@sqlite.org/sqlite-wasm';
import { resolveObjectURL } from 'node:buffer';
import { readFileSync } from 'node:fs';
import { expect, test, vi } from 'vitest';
import { pluginsDdl } from '../../schema/pluginsFile';
import { disk } from './fakeDisk';

vi.mock('../data/auth', () => ({ fresh: async () => null }));
const fetch = vi.fn();
vi.stubGlobal('fetch', fetch);
const { keepAnswer, receive, received, receivedAnswers } = await import('./plugins');
const sqlite3 = await sqlite3InitModule();

const KEPT = 'plugin-answers.sqlite3';
const definition = { title: 'Tree check', elements: [{ type: 'text', name: 'block' }, { type: 'paneldynamic', name: 'trees', templateElements: [{ type: 'text', name: 'species' }] }] };

/** A phone's plugins file: one form, an answer and the fix that replaced it, one entry, one photo. */
function phoneFile(): Uint8Array {
	const db = new sqlite3.oo1.DB();
	for (const sql of pluginsDdl.split('--> statement-breakpoint')) db.exec(sql);
	db.exec(`INSERT INTO plugin (id, definition, madeBy, publishedAt, addedAt) VALUES ('tc', '${JSON.stringify(definition)}', 'Sam', '2026-11-01', '2026-11-01')`);
	db.exec(`INSERT INTO answer (id, plugin, filledAt, data, editedByKey) VALUES ('a1', 'tc', '2026-11-04', '{"block":"B1"}', 'sam')`);
	db.exec(`INSERT INTO answer (id, plugin, filledAt, replaces, data, editedByKey) VALUES ('a2', 'tc', '2026-11-05', 'a1', '{"block":"B2"}', 'sam')`);
	db.exec(`INSERT INTO answerRow (id, answer, groupKey, n, data) VALUES ('r1', 'a2', 'trees', 1, '{"species":"Fdc"}')`);
	db.exec(`INSERT INTO photo VALUES ('ph1', 'image/png', x'89504e47', '2026-11-05')`);
	const bytes = sqlite3.capi.sqlite3_js_db_export(db);
	db.close();
	return bytes;
}

const photo = async (url: string | undefined) => {
	const blob = resolveObjectURL(url!)!;
	return [blob.type, [...new Uint8Array(await blob.arrayBuffer())]];
};

test('a browser that has kept nothing has received nothing', async () => {
	expect(await received()).toEqual([]);
});

test("a file that isn't a plugins file is refused, and nothing is kept", async () => {
	await expect(receive(new TextEncoder().encode('just some notes'))).rejects.toThrow("isn't a Get Cache plugins file.");
	await expect(receive(new Uint8Array(readFileSync(new URL('../../public/sample.sqlite', import.meta.url))))).rejects.toThrow("isn't a Get Cache plugins file.");
	expect(disk.has(KEPT)).toBe(false);
});

test('a file that fails to load never blocks the next one', async () => {
	// SQLite's allocator refuses a Node Buffer, as it would a file too big for memory: the load throws after the attach.
	await expect(receive(Buffer.from(phoneFile()))).rejects.toThrow();
	expect(disk.has(KEPT)).toBe(false);
});

test("a phone's first file lands whole in a fresh browser; sent again, it adds nothing", async () => {
	expect(await receive(phoneFile())).toEqual({ plugin: 1, photo: 1, answer: 2, answerRow: 1 });
	expect(disk.has(KEPT)).toBe(true);
	expect(await receive(phoneFile())).toEqual({ plugin: 0, photo: 0, answer: 0, answerRow: 0 });
	expect(await received()).toEqual([{ id: 'tc', answers: 1, lastAt: '2026-11-05' }]);
});

test("a plugin's answers read back as stored, with their entries and photos", async () => {
	const got = await receivedAnswers('tc', definition);
	expect(got.answers.map((a) => [a.id, a.replaces, a.data])).toEqual([['a1', null, { block: 'B1' }], ['a2', 'a1', { block: 'B2' }]]);
	expect(got.rows.map((r) => [r.id, r.answer, r.data])).toEqual([['r1', 'a2', { species: 'Fdc' }]]);
	expect(await photo(got.photos.get('ph1'))).toEqual(['image/png', [0x89, 0x50, 0x4e, 0x47]]);
});

test("a fill that doesn't fit its form is refused, and the kept file is untouched", async () => {
	const before = disk.get(KEPT);
	const form = { id: 'tc', definition, madeBy: 'Sam', logo: null, publishedAt: '2026-11-01' } as never;
	await expect(keepAnswer(form, { nope: 'x' }, new Map(), 'me')).rejects.toThrow('nope is not a field here');
	await expect(keepAnswer(form, { block: 'B3', trees: [{ height: 2 }] }, new Map(), 'me')).rejects.toThrow('height is not a field here');
	expect(disk.get(KEPT)).toBe(before);
});

test('a fill here keeps its photo beside the answer; signed out, Central hears nothing', async () => {
	const form = { id: 'tc', definition, madeBy: 'Sam', logo: null, publishedAt: '2026-11-01' } as never;
	const pic = new File([new Uint8Array([1, 2, 3])], 'tree.jpg', { type: 'image/jpeg' });
	await keepAnswer(form, { block: 'B3' }, new Map([['ph2', pic]]), 'me');
	const got = await receivedAnswers('tc', definition);
	expect(got.answers.at(-1)).toMatchObject({ data: { block: 'B3' }, editedByKey: 'me' });
	expect(await photo(got.photos.get('ph2'))).toEqual(['image/jpeg', [1, 2, 3]]);
	expect(fetch).not.toHaveBeenCalled();
});
