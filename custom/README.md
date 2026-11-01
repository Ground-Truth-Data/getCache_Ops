# custom/ — yours

Everything your company adds lives here; upstream never edits it.

## `brand.ts` — name, logo, colour

```ts
import logo from './jrp-logo.svg'; // the image sits beside this file

export default { name: 'JRP Ops', logo, accent: '#b5462c' };
```

Any field left out keeps the default.

## `plugins/*.ts` — your tabs

Each file is one tab. This one pays a per-tree rate per day and downloads the
result as CSV; `PLUGIN_API.md` has the rest of `ops`.

```ts
import type { Plugin } from '../../src/plugin/api';
import { table } from '../../src/plugin/table';

const RATE = 0.14;

export default {
	id: 'jrp-payroll',
	name: 'Payroll',
	api: 1,
	minSchema: 57,
	mount(el, ops) {
		const rows = ops.query(
			`SELECT b.plantedDt AS date, CAST(sum(t.plantedQty) AS INTEGER) AS trees, round(sum(t.plantedQty) * ?, 2) AS pay
			 FROM bagUpView b JOIN tallyView t USING (bagUpKey) GROUP BY b.plantedDt ORDER BY b.plantedDt`,
			[RATE],
		);
		const csv = [Object.keys(rows[0] ?? {}), ...rows.map(Object.values)].map((r) => r.join(',')).join('\n');
		const button = document.createElement('button');
		button.textContent = 'Download CSV';
		button.onclick = () => ops.download('jrp-payroll.csv', csv);
		el.append(button, table('Payroll', rows));
		return () => el.replaceChildren();
	},
} satisfies Plugin;
```
