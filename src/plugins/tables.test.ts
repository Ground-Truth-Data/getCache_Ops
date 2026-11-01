import { expect, test } from 'vitest';
import { csv, view } from './tables';

test('csv quotes only cells that need it and leaves nulls empty', () => {
	expect(csv([{ a: 1, b: 'x,y', c: null }, { a: 2, b: 'say "hi"', c: 'line\nbreak' }])).toBe(
		'a,b,c\r\n1,"x,y",\r\n2,"say ""hi""","line\nbreak"\r\n',
	);
});

test('csv of no rows is empty', () => {
	expect(csv([])).toBe('');
});

const rows = Array.from({ length: 450 }, (_, i) => ({ n: i, name: i % 2 ? `odd ${i}` : `even ${i}`, note: i === 7 ? null : 'x' }));

test('view pages 200 rows at a time and clamps a page past the end', () => {
	expect(view(rows, '', { col: '', asc: true }, 0)).toMatchObject({ page: 0, last: 2, label: 'rows 1–200 of 450' });
	const v = view(rows, '', { col: '', asc: true }, 9);
	expect(v).toMatchObject({ page: 2, label: 'rows 401–450 of 450' });
	expect(v.rows).toHaveLength(50);
});

test('view filters across every column, case-blind, before paging', () => {
	const v = view(rows, ' ODD 1', { col: '', asc: true }, 0);
	expect(v.hits.every((r) => String(r.name).startsWith('odd 1'))).toBe(true);
	expect(v.label).toBe(`rows 1–${v.hits.length} of ${v.hits.length}`);
	expect(view(rows, 'nothing here', { col: '', asc: true }, 0)).toMatchObject({ page: 0, label: 'rows 0–0 of 0' });
});

test('view sorts the matches, nulls last', () => {
	expect(view(rows, '', { col: 'n', asc: false }, 0).rows[0].n).toBe(449);
	expect(view(rows, '', { col: 'note', asc: false }, 2).rows.at(-1)?.n).toBe(7);
});
