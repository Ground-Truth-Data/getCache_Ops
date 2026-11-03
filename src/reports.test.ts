import { readFileSync } from 'node:fs';
import { beforeAll, expect, test } from 'vitest';
import { openDatabase, query } from './data/db';
import { reports } from './reports';

beforeAll(async () => {
	await openDatabase(readFileSync(new URL('../public/sample.sqlite', import.meta.url)));
});

const rows = (slug: string) => query(reports.find((r) => r.slug === slug)!.sql);
const total = (slug: string, col: string) => rows(slug).reduce((n, r) => n + ((r[col] as number) ?? 0), 0);

test('one report per pill', () => {
	expect(reports.map((r) => r.slug)).toEqual(['planting', 'days', 'trees', 'deliveries', 'blocks', 'quality', 'surveys']);
});

test.each([
	['planting', ['date', 'block', 'piece', 'cache', 'bag', 'time', 'planter', 'lot', 'trees', 'value', 'per tree', 'currency']],
	['trees', ['lot', 'trees/box', 'trees/bundle', 'per tree', 'trees', 'value', 'currency', 'days', 'blocks']],
	['deliveries', ['cache', 'block', 'lot', 'boxes', 'trees/box', 'total', 'counted', 'counted by', 'delivery', 'delivered', 'delivered by']],
	['days', ['date', 'trees', 'bag-ups']],
	['blocks', ['block', 'allocated', 'calculated', 'delivered', 'planted', 'in caches', 'left to plant']],
	['surveys', ['survey', 'block', 'date', 'stems/ha', 'total ha', 'plots', 'occupied', 'trees planted', 'faults', 'missed', 'excess', 'Density', 'Quality', 'Payment']],
	['quality', ['plot no.', 'plot ID', 'survey', 'block', 'trees planted', 'plantable spots', 'excess', 'credit', 'unsatisfactory', 'comments', 'faults', 'time', 'Open LoCode', 'surveyor', 'occupied']],
])('%s has rows on the sample and the app’s columns, in its order, with no ids, keys or JSON', (slug, cols) => {
	const r = rows(slug);
	expect(r.length).toBeGreaterThan(0);
	expect(Object.keys(r[0])).toEqual(cols);
});

test('the reports agree on the season’s trees', () => {
	const planted = total('planting', 'trees');
	expect(total('trees', 'trees')).toBe(planted);
	expect(total('days', 'trees')).toBe(planted);
	expect(total('blocks', 'planted')).toBe(planted);
	expect(total('blocks', 'in caches')).toBe(total('deliveries', 'total'));
	expect(total('blocks', 'delivered')).toBe(planted + total('blocks', 'in caches'));
});

test('the plots add up to their surveys', () => {
	expect(total('quality', 'trees planted')).toBe(total('surveys', 'trees planted'));
	expect(total('quality', 'unsatisfactory')).toBe(total('surveys', 'faults'));
	expect(rows('quality').filter((r) => r.occupied === 'yes').length).toBe(total('surveys', 'occupied'));
});

test('a bag-up filed at a cache pin shows under cache, never under piece', () => {
	const caches = new Set(query(`SELECT featureName FROM mapFeatureView WHERE pinIcon = 'cache'`).map((r) => r.featureName));
	const planting = rows('planting');
	expect(planting.some((r) => caches.has(r.cache))).toBe(true);
	expect(planting.filter((r) => caches.has(r.piece))).toEqual([]);
});

test('quality pays on the 704 curve', () => {
	const paid = rows('surveys').filter((r) => r.Quality != null);
	expect(paid.length).toBeGreaterThan(0);
	for (const { Quality, Payment } of paid) {
		const a = (Quality as number) * 1.08;
		expect(Payment).toBeCloseTo(Math.max(0, Math.min(100, a - (100 - a) ** 2 / 8)), 0);
	}
});
