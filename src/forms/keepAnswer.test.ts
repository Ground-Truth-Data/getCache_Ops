import { expect, test, vi } from 'vitest';
import './fakeDisk';

vi.mock('../data/auth', () => ({ fresh: async () => ({ access_token: 't' }) }));
const fetch = vi.fn(async (_url: string, _init?: RequestInit) => Response.json([{}]));
vi.stubGlobal('fetch', fetch);
const { keepAnswer, received } = await import('./plugins');

test('Tree check with a repeating Trees section saves into a browser with no plugins file yet', async () => {
	const definition = { title: 'Tree check', elements: [{ type: 'text', name: 'block' }, { type: 'paneldynamic', name: 'trees', templateElements: [{ type: 'text', name: 'species' }] }] };
	const form = { id: 'tc', definition, madeBy: 'Chris', logo: null, publishedAt: '2026-11-06', copiedFrom: null, orgKey: null } as never;
	await keepAnswer(form, { block: 'B12', trees: [{ species: 'Fdc' }, { species: 'Pli' }] }, new Map(), 'me');
	expect((await received()).map((r) => [r.id, r.answers])).toEqual([['tc', 1]]);
	// Central locks a form from its receipts: a fill here sends one, as a phone does.
	const [[url, init]] = fetch.mock.calls;
	expect([url.replace(/^.*\/rest\/v1\//, ''), init?.method, Object.keys(JSON.parse(String(init?.body)))]).toEqual(['pluginReceipt', 'POST', ['answer', 'plugin']]);
});
