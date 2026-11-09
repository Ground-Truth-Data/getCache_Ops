import { expect, test, vi } from 'vitest';
import { axisEnd, blockOrder, charts, quick, quickAxes } from './charts';
import { TREE } from './trees';

// Plot draws into a DOM Ops' tests don't have; what is checked here is what each chart asks Plot for.
type Mark = { mark: string; data: Record<string, unknown>[]; opts: Record<string, any> };
vi.mock('@observablehq/plot', () => {
	const mark = (name: string) => (data: unknown, opts: unknown = {}) => ({ mark: name, data, opts });
	return { plot: (o: unknown) => o, barX: mark('barX'), barY: mark('barY'), rectY: mark('rectY'), ruleX: mark('ruleX'), ruleY: mark('ruleY'), text: mark('text') };
});
vi.stubGlobal('document', { body: 'body' });
vi.stubGlobal('getComputedStyle', (el: unknown) => (el === 'body' ? { backgroundColor: 'rgb(1, 2, 3)' } : { getPropertyValue: (k: string) => (k === '--accent' ? '#ccff00' : '') }));
const el = (width: number) => ({ clientWidth: width }) as HTMLElement;
const drawn = (chart: unknown) => chart as unknown as Record<string, any> & { marks: Mark[] };

const block = (trees: number, allocated = 0) => ({ block: 'b', trees, allocated });

test('one block that dwarfs the rest is cut: the axis ends just past the tallest normal block', () => {
	const rows = [block(9000, 10000), block(12000, 12000), block(8000, 9000), block(11000, 11000), block(1_200_000, 1_200_000)];
	expect(axisEnd(rows)).toBeCloseTo(13_200);
});

test('blocks of a size share an axis, uncut', () => {
	expect(axisEnd([block(9000), block(12000), block(8000), block(15000), block(20000)])).toBeUndefined();
});

test('too few blocks to call one an outlier', () => {
	expect(axisEnd([block(10), block(1_000_000)])).toBeUndefined();
});

test('blocks with no trees yet come last, each group by name', () => {
	const rows = [{ block: 'C', trees: 0 }, { block: 'B', trees: 5 }, { block: 'A', trees: 0 }, { block: 'D', trees: 9 }];
	expect(blockOrder(rows)).toEqual(['B', 'D', 'A', 'C']);
});

test("a query's quick chart puts its first label on x and its first number on y", () => {
	const rows = [{ day: '2026-05-04', crew: 'A', trees: 2100, bags: 9 }, { day: '2026-05-05', crew: 'A', trees: 1800, bags: 8 }];
	expect(quickAxes(rows)).toEqual({ x: 'day', y: 'trees' });
});

test('numbers that come back as text still count, and a column with gaps is not one', () => {
	const rows = [{ block: 'B1', note: null, ha: '22.5' }, { block: 'B2', note: 'wet', ha: '30' }];
	expect(quickAxes(rows)).toEqual({ x: 'block', y: 'ha' });
});

test('no chart for one row, no labels or no numbers', () => {
	expect(quickAxes([{ day: 'd', trees: 1 }])).toBeUndefined();
	expect(quickAxes([{ a: 1, b: 2 }, { a: 3, b: 4 }])).toBeUndefined();
	expect(quickAxes([{ a: 'x' }, { a: 'y' }])).toBeUndefined();
});

test("a query's quick chart: bars in the query's own order, numbers read from text, in the page's accent", () => {
	const rows = [{ crew: 'B', trees: '30' }, { crew: 'A', trees: '10' }];
	const c = drawn(quick(rows, el(640)));
	expect(c).toMatchObject({ width: 640, x: { domain: ['B', 'A'] }, y: { label: 'trees' } });
	const [bars] = c.marks;
	expect(bars).toMatchObject({ mark: 'barY', opts: { x: 'crew', fill: '#ccff00', tip: { fill: 'rgb(1, 2, 3)' } } });
	expect(rows.map(bars.opts.y)).toEqual([30, 10]);
});

test('the days chart is one bar a day, its tip counting trees with the pine', () => {
	const c = drawn(charts.days([{ date: '2026-05-04', trees: 2100 }], el(500)));
	const [bars] = c.marks;
	expect(bars).toMatchObject({ mark: 'rectY', opts: { y: 'trees', interval: 'day', fill: '#ccff00' } });
	expect(bars.opts.x({ date: '2026-05-04' })).toEqual(new Date('2026-05-04'));
	expect(bars.opts.tip.format.y(2100)).toBe(`${TREE}2,100`);
});

const season = [
	{ block: 'North', trees: 9000, allocated: 10000 },
	{ block: 'East', trees: 12000, allocated: 12000 },
	{ block: 'Gully', trees: 0, allocated: 9000 },
	{ block: 'West', trees: 11000, allocated: 11000 },
	{ block: 'Big Burn', trees: 1_200_000, allocated: 1_300_000 },
];
const texts = (c: ReturnType<typeof drawn>) => c.marks.filter((m) => m.mark === 'text');

test('a block past the axis runs to its end, cut by a break, its real trees and allocation printed on it', () => {
	const c = drawn(charts['block-totals'](season, el(1000)));
	const [, end] = c.y.domain;
	expect(end).toBeCloseTo(13_200);
	expect(c.x.domain).toEqual(['Big Burn', 'East', 'North', 'West', 'Gully']);
	const [allocated, planted] = c.marks;
	expect(season.map(allocated.opts.y)).toEqual([10000, 12000, 9000, 11000, end]);
	expect(season.map(planted.opts.y)).toEqual([9000, 12000, 0, 11000, end]);
	const [brk, real] = texts(c);
	expect(brk.data.map((r) => r.block)).toEqual(['Big Burn']);
	expect(brk.opts.text()).toBe('≈');
	expect(real.opts.text(season[4])).toBe(`${TREE}1.2M of 1.3M`);
});

test('a block whose allocation alone runs past the axis prints only the allocation', () => {
	const rows = [...season.slice(0, 4), { block: 'Big Burn', trees: 5000, allocated: 1_300_000 }];
	const [, real] = texts(drawn(charts['block-totals'](rows, el(1000))));
	expect(real.opts.text(rows[4])).toBe(`${TREE}1.3M allocated`);
});

test('a planted count past the axis with its allocation inside prints the trees alone', () => {
	const rows = [...season.slice(0, 4), { block: 'Big Burn', trees: 1_200_000, allocated: 0 }];
	const [, real] = texts(drawn(charts['block-totals'](rows, el(1000))));
	expect(real.opts.text(rows[4])).toBe(`${TREE}1.2M`);
});

test('blocks of a size share an uncut axis: nothing is broken or labelled', () => {
	const c = drawn(charts['block-totals'](season.slice(0, 4), el(1000)));
	expect(c.y.domain).toBeUndefined();
	expect(texts(c).every((t) => t.data.length === 0)).toBe(true);
});

test('bars under 28 px each lie down, every name level, a long one cut to the margin', () => {
	const rows = [...season, { block: 'A very long block name past the margin', trees: 4000, allocated: 5000 }];
	const c = drawn(charts['block-totals'](rows, el(160)));
	expect(c.marks[0].mark).toBe('barX');
	expect(c.height).toBe(rows.length * 22 + 40);
	expect(c.marginLeft).toBe(160);
	expect(c.x.domain).toEqual([0, expect.any(Number)]);
	expect(c.y.tickFormat('North')).toBe('North');
	expect(c.y.tickFormat(rows[5].block)).toBe(`${rows[5].block.slice(0, 160 / 7 - 2)}…`);
});

test('standing bars keep a readable height and room under them for the slanted names', () => {
	expect(drawn(charts['block-totals'](season, el(1000)))).toMatchObject({ height: 400, marginBottom: 60 });
	expect(drawn(charts['block-totals'](season, el(200)))).toMatchObject({ height: 260 });
});
