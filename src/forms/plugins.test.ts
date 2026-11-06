import { afterEach, expect, test, vi } from 'vitest';

vi.stubGlobal('history', { replaceState: () => {} });
const fetch = vi.fn(async (_url: string, _init?: RequestInit) => Response.json([]));
vi.stubGlobal('fetch', fetch);
let signedIn = false;
vi.mock('../data/auth', () => ({ fresh: async () => (signedIn ? { access_token: 't' } : null) }));
const { myPlugins, pluginStore } = await import('./plugins');

const def = { title: 'Tree check', elements: [{ type: 'text', name: 'block' }] };
const meta = () => ({ logo: null });
const sent = () => fetch.mock.calls.filter(([, init]) => init?.method && init.method !== 'GET').map(([url, init]) => [init?.method, url.replace(/^.*\/rest\/v1\//, ''), JSON.parse(String(init?.body))]);
afterEach(() => {
	fetch.mockReset();
	fetch.mockImplementation(async () => Response.json([]));
	signedIn = false;
});

test('a save with no sign-in is refused and sends nothing', async () => {
	await expect(pluginStore('p1', meta, () => {}).save(def)).rejects.toThrow(/sign in/i);
	expect(sent()).toEqual([]);
});

test("a plugin's first save makes its row on Central, and every later save rewrites that row", async () => {
	signedIn = true;
	fetch.mockImplementation(async (_url, init) => Response.json(init?.method === 'GET' ? [] : [{ id: 'p1', definition: def }]));
	const store = pluginStore('p1', meta, () => {});
	await store.load();
	await store.save(def);
	await store.save({ ...def, title: 'Tree check 2' });
	expect(sent()).toEqual([
		['POST', 'plugin', { id: 'p1', definition: def, logo: null }],
		['PATCH', 'plugin?id=eq.p1', { definition: { ...def, title: 'Tree check 2' }, logo: null }],
	]);
});

test('a save Central answers with no row is refused, never taken as saved', async () => {
	signedIn = true;
	await expect(pluginStore('p1', meta, () => {}).save(def)).rejects.toThrow(/did not save/);
});

test("the list is Central's, and a failed read is an error, never an empty list", async () => {
	fetch.mockImplementation(async () => Response.json({ message: 'JWT expired' }, { status: 401 }));
	await expect(myPlugins('me')).rejects.toThrow('JWT expired');
	expect(await myPlugins()).toEqual([]);
});
