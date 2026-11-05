import { expect, test } from 'vitest';
import { moneyIn } from './money';

test('one currency reads with its narrow symbol', () => {
	const money = moneyIn([{ currency: 'CAD' }], 'en');
	expect(money(0.18, 'CAD')).toBe('$0.18');
	expect(money(1690.2, 'CAD')).toBe('$1,690.20');
	expect(money(0.165, 'CAD', true)).toBe('$0.165');
	expect(money(144.6, 'CAD')).toBe('$144.60');
	expect(money(144.315, 'CAD')).toBe('$144.32');
});

test('two currencies sharing a symbol tell themselves apart', () => {
	const money = moneyIn([{ currency: 'CAD' }, { currency: 'USD' }, { currency: 'GBP' }], 'en');
	expect(money(3.33, 'CAD')).toBe('CA$3.33');
	expect(money(3.33, 'USD')).toBe('$3.33');
	expect(moneyIn([{ currency: 'CAD' }, { currency: 'USD' }], 'en-CA')(3.33, 'USD')).toBe('US$3.33');
	expect(money(3.33, 'GBP')).toBe('£3.33');
});

test('a blank amount or currency stays plain', () => {
	const money = moneyIn([], 'en');
	expect(money(null, 'CAD')).toBe('');
	expect(money(2.5, null)).toBe('2.5');
});
