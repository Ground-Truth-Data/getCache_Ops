import { expect, test } from 'vitest';
import { csv } from './tables';

test('csv quotes only cells that need it and leaves nulls empty', () => {
	expect(csv([{ a: 1, b: 'x,y', c: null }, { a: 2, b: 'say "hi"', c: 'line\nbreak' }])).toBe(
		'a,b,c\r\n1,"x,y",\r\n2,"say ""hi""","line\nbreak"\r\n',
	);
});

test('csv of no rows is empty', () => {
	expect(csv([])).toBe('');
});
