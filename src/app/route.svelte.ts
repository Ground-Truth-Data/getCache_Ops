// Ops' address is a real path under index.html's <base>: /ops/plugins on getcache.org, /plugins on a company's own.
const root = new URL(document.baseURI).pathname;
const here = () => location.pathname.slice(root.length) + location.search;

/** Moves to a path relative to Ops' root, without a page load. */
export function go(to: string, replace = false) {
	history[replace ? 'replaceState' : 'pushState'](null, '', new URL(to, document.baseURI));
	route.path = here();
}

// A #/ link shared before Ops had paths still lands on its page.
if (location.hash.startsWith('#/')) history.replaceState(null, '', new URL(location.hash.slice(2), document.baseURI));
export const route = $state({ path: here() });

addEventListener('popstate', () => (route.path = here()));
addEventListener('click', (e) => {
	const a = (e.target as Element | null)?.closest?.('a');
	if (!a?.href || e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || a.target || a.hasAttribute('download')) return;
	const url = new URL(a.href);
	if (url.origin !== location.origin || !url.pathname.startsWith(root)) return;
	e.preventDefault();
	go(url.href);
});
