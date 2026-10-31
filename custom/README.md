# custom/ — yours

Everything your company adds lives here. Upstream never edits this folder, so
`git pull upstream main` never conflicts with it.

## Your name, logo and colour — `custom/brand.ts` (optional)

```ts
export default {
	name: 'JRP Ops',
	logo: '/jrp-logo.svg', // put the file in public/
	accent: '#b5462c',
};
```

Leave out any field to keep the default. Delete the file to go back to Get Cache Ops.

## Your pages and reports — `custom/plugins/*.ts`

Each file is one tab, picked up when the site is built. A plugin gets the open
file read-only through `ops`; see `PLUGIN_API.md` for everything in it.

```ts
import type { Plugin } from '../../src/plugin/api';

export default {
	id: 'jrp-payroll',
	name: 'Payroll',
	api: 1,
	minSchema: 57,
	mount(el, ops) {
		const rows = ops.query(`SELECT boxTag, sum(plantedQty * pricePerTree) AS pay FROM tallyView GROUP BY boxTag`);
		el.textContent = JSON.stringify(rows);
		return () => el.replaceChildren();
	},
} satisfies Plugin;
```

`mount` gets a plain DOM element, so use Svelte, another framework or nothing.
