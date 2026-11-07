import { expect, test, vi } from 'vitest';

// A browser that has never kept an answer: no plugins file on disk.
const disk = new Map<string, Uint8Array>();
vi.stubGlobal('navigator', {
	storage: {
		getDirectory: async () => ({
			getFileHandle: async (name: string, o?: { create?: boolean }) => {
				if (!disk.has(name) && !o?.create) throw new DOMException('missing', 'NotFoundError');
				return {
					getFile: async () => new Blob([disk.get(name) as Uint8Array<ArrayBuffer>]),
					createWritable: async () => ({ write: async (b: Uint8Array) => void disk.set(name, new Uint8Array(b)), close: async () => {} }),
				};
			},
		}),
	},
});
vi.mock('../data/auth', () => ({ fresh: async () => ({ access_token: 't' }) }));
const fetch = vi.fn(async (_url: string, _init?: RequestInit) => Response.json([{}]));
vi.stubGlobal('fetch', fetch);
const { keepAnswer, received } = await import('./plugins');

test('Tree check with a repeating Trees section saves into a browser with no plugins file yet', async () => {
	const definition = { title: 'Tree check', elements: [{ type: 'text', name: 'block' }, { type: 'paneldynamic', name: 'trees', templateElements: [{ type: 'text', name: 'species' }] }] };
	const form = { id: 'tc', definition, madeBy: 'Chris', logo: null, publishedAt: '2026-11-06', copiedFrom: null, orgKey: null } as never;
	await keepAnswer(form, { block: 'B12', trees: [{ species: 'Fdc' }, { species: 'Pli' }] }, new Map(), 'me');
	expect((await received()).map((r) => [r.id, r.answers])).toEqual([['tc', 1]]);
	// Central counts submissions from receipts: a fill here sends one, as a phone does, or the card says 0.
	const [[url, init]] = fetch.mock.calls;
	expect([url.replace(/^.*\/rest\/v1\//, ''), init?.method, Object.keys(JSON.parse(String(init?.body)))]).toEqual(['pluginReceipt', 'POST', ['answer', 'plugin']]);
});
