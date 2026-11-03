import { expect, test } from 'vitest';
import { apply, facets } from './filters';

const rows = [
	{ date: '2026-05-01', block: 'B2', planter: 'Ann', trees: 100 },
	{ date: '2026-05-08', block: 'B1', planter: 'Bo', trees: 200 },
	{ date: '2026-05-10', block: 'B1', planter: 'Ann', trees: 300 },
];

test('facets finds the date column, the natural sorts and the few-valued text columns', () => {
	const f = facets(rows);
	expect(f.dateCol).toBe('date');
	expect(f.sorts.map(([c]) => c)).toEqual(['date', 'block', 'planter']);
	expect(f.picks).toEqual([
		['block', ['B1', 'B2']],
		['planter', ['Ann', 'Bo']],
	]);
});

test('days count back from the newest row, the newest day included', () => {
	expect(apply(rows, { pick: {}, days: 1 }, 'date').map((r) => r.trees)).toEqual([300]);
	expect(apply(rows, { pick: {}, days: 3 }, 'date').map((r) => r.trees)).toEqual([200, 300]);
	expect(apply(rows, { pick: {}, from: '2026-05-02', to: '2026-05-09' }, 'date').map((r) => r.trees)).toEqual([200]);
});

test('this season keeps the newest row’s calendar year', () => {
	const years = [{ date: '2025-06-01', trees: 1 }, ...rows];
	expect(apply(years, { pick: {}, season: true }, 'date').map((r) => r.trees)).toEqual([100, 200, 300]);
	expect(apply(years, { pick: {} }, 'date')).toHaveLength(4);
});

test('a pick keeps only its value; newest sorts the date column descending', () => {
	expect(apply(rows, { pick: { planter: 'Ann' }, sort: 'date' }, 'date').map((r) => r.trees)).toEqual([300, 100]);
	expect(apply(rows, { pick: {}, sort: 'block' }, 'date').map((r) => r.block)).toEqual(['B1', 'B1', 'B2']);
});
