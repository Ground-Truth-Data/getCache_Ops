import { expect, test } from 'vitest';
import { amount, byCurrency, columnTotals, mark } from './money';

test('Canadian dollars are plain $; another dollar says whose', () => {
	expect(mark('CAD')).toBe('$');
	expect(mark('USD')).toBe('US$');
	expect(mark('GBP')).toBe('£');
	expect(mark('EUR')).toBe('€');
});

test('a cell is a plain number: two decimals, a rate up to four', () => {
	expect(amount(1690.2, false, 'en')).toBe('1,690.20');
	expect(amount(144.315, false, 'en')).toBe('144.32');
	expect(amount(0.165, true, 'en')).toBe('0.165');
	expect(amount(0.18, true, 'en')).toBe('0.18');
	expect(amount(null)).toBe('');
});

test('rows group by currency, the biggest group first, sorted order kept inside each', () => {
	const rows = [
		{ s: 'a', currency: 'GBP' },
		{ s: 'b', currency: 'CAD' },
		{ s: 'c', currency: 'CAD' },
		{ s: 'd', currency: 'GBP' },
		{ s: 'e', currency: 'CAD' },
	];
	expect(byCurrency(rows, 'currency').map(([c, rs]) => [c, rs.map((r) => r.s).join('')])).toEqual([
		['CAD', 'bce'],
		['GBP', 'ad'],
	]);
});

test('each currency totals its own rows: trees and value are the sum of the cells shown, a rate is never summed', () => {
	const rows = [
		{ block: 'B1', trees: 240, value: 52.8, 'per tree': 0.22, currency: 'CAD' },
		{ block: 'B1', trees: 120, value: 36, 'per tree': 0.3, currency: 'CAD' },
		{ block: 'B2', trees: 200, value: null, 'per tree': null, currency: 'CAD' },
		{ block: 'B3', trees: 240, value: 60, 'per tree': 0.25, currency: 'USD' },
	];
	const cols = ['block', 'trees', 'value', 'per tree'];
	const sums = byCurrency(rows, 'currency').map(([code, these]) => [code, columnTotals(these, cols, ['value', 'per tree'], [], 'en')]);
	expect(sums).toEqual([
		['CAD', { trees: '560', value: '88.80' }],
		['USD', { trees: '240', value: '60.00' }],
	]);
});
