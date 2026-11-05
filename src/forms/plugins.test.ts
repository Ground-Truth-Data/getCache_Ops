import { afterEach, expect, test, vi } from 'vitest';

const mem = new Map<string, string>();
vi.stubGlobal('localStorage', { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => mem.set(k, v), removeItem: (k: string) => mem.delete(k) });
vi.stubGlobal('history', { replaceState: () => {} });
const fetch = vi.fn(async (_url: string, _init?: RequestInit) => Response.json([]));
vi.stubGlobal('fetch', fetch);
const { pluginStore } = await import('./plugins');

const def = { title: 'Tree check', elements: [{ type: 'text', name: 'block' }] };
const meta = () => ({ madeBy: 'Little Smokey', logo: null });
const sent = () => fetch.mock.calls.filter(([, init]) => init?.method && init.method !== 'GET');
afterEach(() => (mem.clear(), fetch.mockClear()));

test('a plugin is made and saved with no account, and nothing leaves the browser', async () => {
	const store = pluginStore('new', meta, () => {});
	await store.save(def);
	expect(await store.load()).toMatchObject([{ version: 1, definition: def, madeBy: 'Little Smokey', publishedAt: null }]);
	expect(sent()).toEqual([]);
});

test('publishing asks for a sign-in and sends nothing without one', async () => {
	const store = pluginStore('new', meta, () => {});
	await store.save(def);
	await expect(store.publish('local')).rejects.toThrow(/sign in/i);
	expect(sent()).toEqual([]);
});
