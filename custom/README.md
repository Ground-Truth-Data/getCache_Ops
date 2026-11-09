# custom/ — yours

Everything your company adds lives here; upstream never edits it.

## `brand.ts` — name, logo, colour

```ts
import logo from './jrp-logo.svg'; // the image sits beside this file

export default { name: 'JRP Ops', logos: [logo], accent: '#b5462c' };
```

Any field left out keeps the default.

## `reports/*.json` — your reports

Each file is one tab: a report your company hosts at its own address. Ops keeps
only this, and fetches the code each time the tab opens.

```json
{ "id": "jrp-payroll", "name": "Payroll", "url": "https://jrp.example/payroll.js", "tables": ["bagUpView", "tallyView"] }
```

`PLUGIN_API.md` says what the code can do; `src/starters/report/report.js` is
one to copy.
