import { readFileSync } from 'node:fs';
import { beforeAll, expect, test } from 'vitest';
import { openDatabase, query } from '../data/db';
import { prompt, refusal } from './ask';

beforeAll(async () => {
	await openDatabase(readFileSync(new URL('../../public/sample.sqlite', import.meta.url)));
});

test('the prompt carries every view with its columns, and the request', () => {
	const p = prompt(query, 'group by block, sum trees');
	expect(p).toMatch(/tallyView\(.*plantedQty/);
	expect(p).toContain('bagUpView(');
	expect(p).not.toMatch(/Entity\(/);
	expect(p).toContain('"Planters" column');
	expect(p.endsWith('Request: group by block, sum trees')).toBe(true);
});

test('only one SELECT or WITH runs', () => {
	expect(refusal('SELECT 1;')).toBeUndefined();
	expect(refusal('  with x AS (SELECT 1) SELECT * FROM x')).toBeUndefined();
	expect(refusal('DELETE FROM tallyEntity')).toMatch(/Only a SELECT/);
	expect(refusal('SELECT 1; DROP TABLE tallyEntity')).toMatch(/One statement/);
});
