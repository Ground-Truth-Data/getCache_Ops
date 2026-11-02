import { expect, test, vi } from 'vitest';
import { askGetCache, type Reply } from './bridge';

test('asks Get Cache for its database and hands over every reply, ignoring other asks', async () => {
	const app = new BroadcastChannel('getcache-ops');
	const asks: unknown[] = [];
	app.onmessage = (e) => {
		asks.push(e.data);
		app.postMessage({ op: 'export' });
		app.postMessage({ op: 'bytes', bytes: new Uint8Array([asks.length]), signedIn: asks.length > 1, syncedAt: '2026-11-01T21:00:00Z' });
	};
	const got: Reply[] = [];
	const { ask, close } = askGetCache((reply) => got.push(reply));
	await vi.waitFor(() => expect(got).toHaveLength(1));
	ask();
	await vi.waitFor(() => expect(got).toHaveLength(2));
	expect(asks).toEqual([{ op: 'export' }, { op: 'export' }]);
	expect(got.map((r) => [r.bytes[0], r.signedIn, r.syncedAt])).toEqual([
		[1, false, '2026-11-01T21:00:00Z'],
		[2, true, '2026-11-01T21:00:00Z'],
	]);
	close();
	app.close();
});
