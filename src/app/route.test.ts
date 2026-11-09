import { afterEach, expect, test, vi } from 'vitest';

// A browser just big enough for the router: one address, a history, and the window's listeners.
function browser(at: string) {
	const url = new URL(at);
	const loc = { origin: url.origin, pathname: url.pathname, search: url.search, hash: url.hash };
	const entries: string[] = [at];
	const to = (u: URL | string) => {
		const next = new URL(u, 'https://getcache.org/ops/');
		Object.assign(loc, { pathname: next.pathname, search: next.search, hash: next.hash });
		return next.href;
	};
	const on: Record<string, (e: unknown) => void> = {};
	vi.stubGlobal('document', { baseURI: 'https://getcache.org/ops/' });
	vi.stubGlobal('location', loc);
	vi.stubGlobal('history', {
		pushState: (_: unknown, __: string, u: URL) => entries.push(to(u)),
		replaceState: (_: unknown, __: string, u: URL) => (entries[entries.length - 1] = to(u)),
	});
	vi.stubGlobal('addEventListener', (type: string, fn: (e: unknown) => void) => (on[type] = fn));
	return { loc, entries, on };
}

const load = async () => {
	vi.resetModules();
	return import('./route.svelte');
};

const click = (href: string, over: Record<string, unknown> = {}, attrs: Record<string, string> = {}) => {
	const a = { href, target: '', hasAttribute: (n: string) => n in attrs, ...attrs };
	const e = { target: { closest: () => a }, defaultPrevented: false, button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, prevented: false, preventDefault() { this.prevented = true; }, ...over };
	return e;
};

afterEach(() => vi.unstubAllGlobals());

test("the path is the address under Ops' root, query included", async () => {
	browser('https://getcache.org/ops/plugins?form=a');
	expect((await load()).route.path).toBe('plugins?form=a');
});

test('go moves the address without a page load; replace leaves no history entry', async () => {
	const { entries } = browser('https://getcache.org/ops/');
	const { go, route } = await load();
	go('reports');
	expect(route.path).toBe('reports');
	expect(entries).toEqual(['https://getcache.org/ops/', 'https://getcache.org/ops/reports']);
	go('plugins', true);
	expect(route.path).toBe('plugins');
	expect(entries).toEqual(['https://getcache.org/ops/', 'https://getcache.org/ops/plugins']);
});

test('a #/ link shared before Ops had paths lands on its page', async () => {
	const { entries } = browser('https://getcache.org/ops/#/reports');
	expect((await load()).route.path).toBe('reports');
	expect(entries).toEqual(['https://getcache.org/ops/reports']);
});

test('back and forward follow the address', async () => {
	const { loc, on } = browser('https://getcache.org/ops/reports');
	const { route } = await load();
	loc.pathname = '/ops/plugins';
	on.popstate({});
	expect(route.path).toBe('plugins');
});

test("a plain click on a link inside Ops moves in place", async () => {
	const { on, entries } = browser('https://getcache.org/ops/');
	const { route } = await load();
	const e = click('https://getcache.org/ops/reports');
	on.click(e);
	expect(e.prevented).toBe(true);
	expect(route.path).toBe('reports');
	expect(entries).toHaveLength(2);
});

test('the browser keeps every other click: another site, outside Ops, a new tab, a modifier, a download, or already handled', async () => {
	const { on, entries } = browser('https://getcache.org/ops/');
	const { route } = await load();
	const kept = [
		click('https://example.org/ops/reports'),
		click('https://getcache.org/app/menu'),
		click('https://getcache.org/ops/reports', { button: 1 }),
		...['metaKey', 'ctrlKey', 'shiftKey', 'altKey'].map((k) => click('https://getcache.org/ops/reports', { [k]: true })),
		click('https://getcache.org/ops/reports', {}, { target: '_blank' }),
		click('https://getcache.org/ops/sheet.csv', {}, { download: '' }),
		click('https://getcache.org/ops/reports', { defaultPrevented: true }),
		{ ...click(''), target: { closest: () => null } },
		{ ...click(''), target: null },
	];
	for (const e of kept) on.click(e);
	expect(kept.map((e) => e.prevented)).toEqual(kept.map(() => false));
	expect(route.path).toBe('');
	expect(entries).toHaveLength(1);
});
