import { expect, test } from 'vitest';
import { amount, columnTotals, currencies, mark } from './money';

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

test('one table over two currencies: trees sum, money never does, a rate never', () => {
	const rows = [
		{ block: 'B1', trees: 240, value: 52.8, 'per tree': 0.22, currency: 'CAD' },
		{ block: 'B2', trees: 200, value: null, 'per tree': null, currency: 'CAD' },
		{ block: 'B3', trees: 240, value: 60, 'per tree': 0.25, currency: 'USD' },
	];
	const cash = ['value', 'per tree'];
	expect(currencies(rows, 'currency')).toEqual(['CAD', 'USD']);
	expect(columnTotals(rows, ['block', 'trees', ...cash], cash, cash, 'en')).toEqual({ trees: '680' });
	expect(columnTotals(rows.slice(0, 2), ['trees', ...cash], cash, [], 'en')).toEqual({ trees: '440', value: '52.80' });
});
