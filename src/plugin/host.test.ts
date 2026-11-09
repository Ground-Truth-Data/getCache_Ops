import { expect, test } from 'vitest';
import { answer, type Report } from './host';

const report: Report = { id: 'x', name: 'X', url: 'https://x.test/x.js', tables: ['tallyView'] };
const query = (sql: string) => [{ sql }];

test('the box gets rows of a table its manifest lists', () => {
	expect(answer(report, { id: 1, rows: 'tallyView' }, query)).toEqual({ id: 1, rows: [{ sql: 'SELECT * FROM "tallyView"' }] });
});

test('any other table is refused, whatever else the message carries', () => {
	expect(answer(report, { id: 2, rows: 'personEntity', sql: 'SELECT * FROM personEntity' }, query)).toEqual({ id: 2, error: 'X was not allowed personEntity.' });
});

test('a message that is not a request gets no answer', () => {
	expect(answer(report, { sql: 'SELECT 1' }, query)).toBeUndefined();
	expect(answer(report, 'tallyView', query)).toBeUndefined();
});
