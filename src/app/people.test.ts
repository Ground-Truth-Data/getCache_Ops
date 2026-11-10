import { copyFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { expect, test } from 'vitest';
import { openDatabase } from '../data/db';
import { people } from './people';

const SAM = '4ca769b1-be0f-4ecd-a41e-8cee8bbf5caa';

/** The sample season, opened on Sam's phone, with one contact Sam renamed and coloured. */
function samsPhone(): Uint8Array {
	const file = join(tmpdir(), `ops-people-${process.pid}.sqlite`);
	copyFileSync(new URL('../../public/sample.sqlite', import.meta.url), file);
	const db = new DatabaseSync(file);
	db.exec(`INSERT INTO appState (appStateId, selfKey) VALUES ('singleton', '${SAM}')`);
	db.exec(`INSERT INTO personEntity VALUES ('lee', '2026-05-05T00:00:00.000Z')`);
	db.exec(`INSERT INTO personTable (versionKey, personKey, username, alias, color, colorPickedAt, kind, actKey) VALUES ('op-lee', 'lee', 'Lee Foreman', 'Boss', '#123456', '2026-05-06T00:00:00.000Z', 'edit', 'act')`);
	db.close();
	return readFileSync(file);
}

test('with no file open there is nobody to name', () => {
	expect(people()).toEqual(new Map());
});

test("each contact under the name the reports print: the phone's owner is you, an alias wins, a picked colour is marked", async () => {
	await openDatabase(samsPhone());
	expect(Object.fromEntries(people())).toEqual({
		'Sam Planter': { label: 'you', color: 'var(--accent)', self: true, picked: false },
		'Jo Checker': { label: 'Jo Checker', color: '#4a90d9', self: false, picked: false },
		Boss: { label: 'Boss', color: '#123456', self: false, picked: true },
	});
});

test('a file with no owner yet names nobody you', async () => {
	await openDatabase(readFileSync(new URL('../../public/sample.sqlite', import.meta.url)));
	expect([...people().values()].some((p) => p.self)).toBe(false);
});
