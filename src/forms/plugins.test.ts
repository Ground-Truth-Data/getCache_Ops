import { afterEach, expect, test, vi } from 'vitest';

const mem = new Map<string, string>();
vi.stubGlobal('localStorage', { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => mem.set(k, v), removeItem: (k: string) => mem.delete(k) });
vi.stubGlobal('history', { replaceState: () => {} });
const fetch = vi.fn(async (_url: string, _init?: RequestInit) => Response.json([]));
vi.stubGlobal('fetch', fetch);
let signedIn = false;
vi.mock('../data/auth', () => ({ fresh: async () => (signedIn ? { access_token: 't' } : null) }));
const { myPlugins, pluginStore } = await import('./plugins');

const def = { title: 'Tree check', elements: [{ type: 'text', name: 'block' }] };
const meta = () => ({ logo: null });
const sent = () => fetch.mock.calls.filter(([, init]) => init?.method && init.method !== 'GET');
afterEach(() => {
	mem.clear();
	fetch.mockReset();
	fetch.mockImplementation(async () => Response.json([]));
	signedIn = false;
});

test('a plugin is made and saved with no account, and nothing leaves the browser', async () => {
	const store = pluginStore('p1', meta, () => {});
	await store.save(def);
	const [draft] = await store.load();
	expect(draft).toMatchObject({ version: 1, definition: def, publishedAt: null });
	expect(draft).not.toHaveProperty('madeBy');
	expect(sent()).toEqual([]);
});

test("a draft is listed and reopens when Central can't be reached", async () => {
	await pluginStore('p1', meta, () => {}).save(def);
	fetch.mockImplementation(async () => Response.json({ message: 'JWT expired' }, { status: 401 }));
	vi.spyOn(console, 'warn').mockImplementation(() => {});
	expect((await myPlugins('me')).map((v) => v.at(-1)?.definition)).toEqual([def]);
	expect((await pluginStore('p1', meta, () => {}).load()).at(-1)?.definition).toEqual(def);
	fetch.mockImplementation(async () => Response.json([]));
});

test('an edit after publishing rewrites the one plugin, never a next version', async () => {
	signedIn = true;
	fetch.mockImplementation(async (url) => Response.json(url.includes('id=eq.p3') ? [{ id: 'p3', definition: def, publishedAt: '2026-11-06', lockedAt: null }] : []));
	const store = pluginStore('p3', meta, () => {});
	const edited = { ...def, elements: [{ type: 'text', name: 'block', title: 'Block number' }] };
	await store.save(edited);
	await store.publish();
	expect(sent().map(([url, init]) => [init?.method, url.replace(/^.*\/rest\/v1\//, ''), JSON.parse(String(init?.body))])).toEqual([
		['PATCH', 'plugin?id=eq.p3', { definition: edited, logo: null }],
	]);
});

test('publishing asks for a sign-in and sends nothing without one', async () => {
	const store = pluginStore('p2', meta, () => {});
	await store.save(def);
	await expect(store.publish('local')).rejects.toThrow(/sign in/i);
	expect(sent()).toEqual([]);
});
