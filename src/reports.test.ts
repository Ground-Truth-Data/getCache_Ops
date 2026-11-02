import { readFileSync } from 'node:fs';
import { beforeAll, expect, test } from 'vitest';
import { openDatabase, query } from './data/db';
import { reports } from './reports';

beforeAll(async () => {
	await openDatabase(readFileSync(new URL('../public/sample.sqlite', import.meta.url)));
});

test('the five reports, each with its own page', () => {
	expect(reports.map((r) => r.slug)).toEqual(['planting', 'trees', 'deliveries', 'allocation', 'quality']);
});

test.each(reports)('$title runs on the sample and shows no ids, keys or JSON', ({ sql }) => {
	const cols = query(`SELECT * FROM (${sql}) LIMIT 1`).flatMap(Object.keys);
	expect(cols.filter((c) => /key|json|\bid\b/i.test(c))).toEqual([]);
});

test('the sample season fills planting, trees, allocation and quality', () => {
	const rows = (slug: string) => query(reports.find((r) => r.slug === slug)!.sql);
	expect(rows('planting')[0]).toEqual({ Date: '2026-05-04', Block: expect.any(String), 'Trees planted': expect.any(Number), 'Bag-ups': expect.any(Number) });
	const total = (slug: string, col: string) => rows(slug).reduce((n, r) => n + (r[col] as number), 0);
	expect(total('trees', 'Trees planted')).toBe(total('planting', 'Trees planted'));
	expect(total('allocation', 'Planted')).toBe(total('planting', 'Trees planted'));
	expect(rows('quality').length).toBeGreaterThan(0);
});
