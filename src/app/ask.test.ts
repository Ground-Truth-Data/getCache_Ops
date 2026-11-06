import { readFileSync } from 'node:fs';
import { beforeAll, expect, test } from 'vitest';
import { openDatabase, query } from '../data/db';
import { prompt, refusal, sqlOf } from './ask';

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
	expect(refusal("SELECT GROUP_CONCAT(x, '; ') FROM t;")).toBeUndefined();
	expect(refusal('-- top days; everyone\nSELECT 1')).toBeUndefined();
	expect(refusal("SELECT ';' ; DELETE FROM t")).toMatch(/One statement/);
});

test('a whole chatty LLM reply runs as its SQL block', () => {
	const reply = "Sure! Here's the query:\n\n```sql\nSELECT 1 AS One;\n```\n\nIt returns one row.";
	expect(query(sqlOf(reply))).toEqual([{ One: 1 }]);
	expect(sqlOf('SELECT 2')).toBe('SELECT 2');
});

test('the sample has an owner, so "my" in a request finds Sam', () => {
	const me = query(`SELECT username FROM personView WHERE personKey =
		(SELECT personKey FROM personIdTable WHERE personId = (SELECT personId FROM userProfile WHERE userProfileId = 'singleton'))`);
	expect(me).toEqual([{ username: 'Sam Planter' }]);
});
