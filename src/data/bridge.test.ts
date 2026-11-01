import { expect, test, vi } from 'vitest';
import { askGetCache } from './bridge';

test('asks Get Cache for its database and hands over every reply, ignoring other asks', async () => {
	const app = new BroadcastChannel('getcache-ops');
	const asks: unknown[] = [];
	app.onmessage = (e) => {
		asks.push(e.data);
		app.postMessage({ op: 'export' });
		app.postMessage({ op: 'bytes', bytes: new Uint8Array([asks.length]) });
	};
	const got: number[] = [];
	const { ask, close } = askGetCache((bytes) => got.push(bytes[0]));
	await vi.waitFor(() => expect(got).toEqual([1]));
	ask();
	await vi.waitFor(() => expect(got).toEqual([1, 2]));
	expect(asks).toEqual([{ op: 'export' }, { op: 'export' }]);
	close();
	app.close();
});
