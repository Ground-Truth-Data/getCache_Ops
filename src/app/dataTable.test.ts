import { expect, test } from 'vitest';
import { csv, totals, view } from './dataTable';

const rows = Array.from({ length: 450 }, (_, i) => ({ n: i, name: i % 2 ? `odd ${i}` : `even ${i}`, note: i === 7 ? null : 'x' }));
const none = { col: '', asc: true };

test('view pages 200 rows at a time and clamps a page past the end', () => {
	expect(view(rows, '', none, 0)).toMatchObject({ page: 0, last: 2, label: 'rows 1–200 of 450' });
	const v = view(rows, '', none, 9);
	expect(v).toMatchObject({ page: 2, label: 'rows 401–450 of 450' });
	expect(v.rows).toHaveLength(50);
});

test('view filters across every column, case-blind, before paging', () => {
	const v = view(rows, ' ODD 1', none, 0);
	expect(v.hits.every((r) => String(r.name).startsWith('odd 1'))).toBe(true);
	expect(v.label).toBe(`rows 1–${v.hits.length} of ${v.hits.length}`);
	expect(view(rows, 'nothing here', none, 0)).toMatchObject({ page: 0, label: 'rows 0–0 of 0' });
});

test('view sorts the matches, nulls last', () => {
	expect(view(rows, '', { col: 'n', asc: false }, 0).rows[0].n).toBe(449);
	expect(view(rows, '', { col: 'note', asc: false }, 2).rows.at(-1)?.n).toBe(7);
});

test('csv writes the given columns, quoting only cells that need it', () => {
	expect(csv([{ a: 1, b: 'x,y', c: null }, { a: 2, b: 'say "hi"', c: 'line\nbreak' }], ['a', 'b', 'c'])).toBe(
		'a,b,c\r\n1,"x,y",\r\n2,"say ""hi""","line\nbreak"\r\n',
	);
	expect(csv([], ['a'])).toBe('a\r\n');
});

test('totals sums number columns, and money only when one currency', () => {
	const cad = [
		{ block: 'B1', trees: 100, value: 15.1, currency: 'CAD' },
		{ block: 'B2', trees: 140, value: 25.2, currency: 'CAD' },
	];
	expect(totals(cad, ['block', 'trees', 'value'], ['value'])).toEqual({ trees: 240, value: { sum: 40.3, currency: 'CAD' } });
	const mixed = [...cad, { block: 'B3', trees: 10, value: 1, currency: 'USD' }];
	expect(totals(mixed, ['block', 'trees', 'value'], ['value'])).toEqual({ trees: 250 });
	expect(totals([{ d: '2026-05-01', n: null }], ['d', 'n'], [])).toEqual({});
});
