import { expect, test } from 'vitest';
import { axisEnd } from './charts';

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
