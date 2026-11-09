import { afterEach, expect, test, vi } from 'vitest';

vi.stubGlobal('history', { replaceState: () => {} });
const fetch = vi.fn(async (_url: string, _init?: RequestInit) => Response.json([]));
vi.stubGlobal('fetch', fetch);
let signedIn = false;
vi.mock('../data/auth', () => ({ fresh: async () => (signedIn ? { access_token: 't' } : null) }));
const { addLink, companyPlugins, copyPlugin, myPlugins, pluginStore, plugins, retirePlugin, SignInNeeded } = await import('./plugins');
const { appHome } = await import('../company/central');

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

const paths = () => fetch.mock.calls.map(([url]) => url.replace(/^.*\/rest\/v1\//, ''));

test("a phone's plugins are read from Central by id, and no ids asks for nothing", async () => {
	expect(await plugins([])).toEqual([]);
	await plugins(['p1', 'p2']);
	await companyPlugins('org1');
	expect(paths()).toEqual(['plugin?id=in.(p1,p2)&select=*,lockedAt,replacedBy,retiredAt,company', 'plugin?orgKey=eq.org1&order=publishedAt.desc&select=*,lockedAt,replacedBy,retiredAt,company']);
});

test('retiring needs a sign-in, and a retire Central answers with no row is refused', async () => {
	await expect(retirePlugin('p1')).rejects.toBeInstanceOf(SignInNeeded);
	expect(fetch).not.toHaveBeenCalled();
	signedIn = true;
	await expect(retirePlugin('p1')).rejects.toThrow('Central did not retire this plugin.');
	fetch.mockImplementation(async () => Response.json([{ plugin: 'p1' }]));
	await retirePlugin('p1');
	expect(sent()).toEqual([['POST', 'pluginRetired', { plugin: 'p1' }], ['POST', 'pluginRetired', { plugin: 'p1' }]]);
});

test("a copy is a new open plugin of your own, crediting the one it came from", async () => {
	const src = { id: 'p1', definition: def, logo: 'logo.png' };
	fetch.mockImplementation(async (_url, init) => Response.json(init?.method === 'POST' ? [{ id: 'new' }] : [src]));
	await expect(pluginStore('p1', meta, () => {}).copy()).rejects.toBeInstanceOf(SignInNeeded);
	signedIn = true;
	const id = await pluginStore('p1', meta, () => {}).copy();
	expect(sent()).toEqual([['POST', 'plugin', { id, definition: def, logo: 'logo.png', copiedFrom: 'p1' }]]);
	fetch.mockImplementation(async () => Response.json([]));
	await expect(copyPlugin('gone')).rejects.toThrow('No published plugin at that link.');
});

test('the add link a QR code carries opens Get Cache on the plugin', () => {
	expect(addLink('p1')).toBe(`${new URL(appHome).origin}/app/plugin?add=p1`);
});
