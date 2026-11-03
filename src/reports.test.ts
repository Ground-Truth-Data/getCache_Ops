import { readFileSync } from 'node:fs';
import { beforeAll, expect, test } from 'vitest';
import { openDatabase, query } from './data/db';
import { reports, seasonReports } from './reports';

beforeAll(async () => {
	await openDatabase(readFileSync(new URL('../public/sample.sqlite', import.meta.url)));
});

const rows = (slug: string, from = '') => {
	const season = seasonReports.find((r) => r.slug === slug);
	return season ? query(season.sql, [from]) : query(reports.find((r) => r.slug === slug)!.sql);
};
const total = (slug: string, col: string, from?: string) => rows(slug, from).reduce((n, r) => n + ((r[col] as number) ?? 0), 0);

test('Home’s tables and the Reports page’s season views, one per pill', () => {
	expect(reports.map((r) => r.slug)).toEqual(['planting', 'trees', 'caches', 'blocks', 'quality', 'surveys']);
	expect(seasonReports.map((r) => r.slug)).toEqual(['days', 'block-totals', 'seedlots']);
});

test.each([
	['planting', ['date', 'block', 'piece', 'cache', 'bag', 'time', 'planter', 'lot', 'trees', 'value', 'per tree', 'currency']],
	['trees', ['lot', 'trees/box', 'trees/bundle', 'per tree', 'trees', 'value', 'currency', 'days', 'blocks']],
	['caches', ['cache', 'block', 'lot', 'boxes', 'trees/box', 'total', 'counted', 'counted by', 'delivery', 'delivered', 'delivered by']],
	['days', ['date', 'trees', 'bag-ups']],
	['block-totals', ['block', 'allocated', 'trees', 'days']],
	['seedlots', ['seedlot', 'species', 'trees', 'days']],
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
	for (const slug of ['days', 'block-totals', 'seedlots']) expect(total(slug, 'trees')).toBe(planted);
	expect(total('blocks', 'planted')).toBe(planted);
	expect(total('blocks', 'in caches')).toBe(total('caches', 'total'));
	expect(total('blocks', 'delivered')).toBe(planted + total('blocks', 'in caches'));
});

test('a season view counts only trees planted on or after its start', () => {
	const late = query(`SELECT CAST(sum(t.plantedQty) AS INTEGER) AS n FROM bagUpView b JOIN tallyView t USING (bagUpKey) WHERE b.plantedDt >= '2026-06-01'`)[0].n;
	for (const slug of ['days', 'block-totals', 'seedlots']) expect(total(slug, 'trees', '2026-06-01')).toBe(late);
	expect(total('days', 'trees', '2027-01-01')).toBe(0);
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
