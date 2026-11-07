# Plugin API

A plugin is one tab: a file in `custom/plugins/`.

```ts
import type { Plugin } from '../../src/plugin/api';

export default {
	id: 'jrp-payroll',   // unique and stable
	name: 'Payroll',     // the tab's label
	api: 1,              // the plugin API major it was built for
	minSchema: 57,       // the oldest Get Cache file it understands
	mount(el, ops) {     // draw into el (any framework or none); return the cleanup
		return () => el.replaceChildren();
	},
} satisfies Plugin;
```

## `ops`

| Member | What it gives you |
|---|---|
| `apiVersion` | This Ops's plugin API, e.g. `'1.0.0'` |
| `schemaVersion` | The open file's Get Cache schema (`PRAGMA user_version`) |
| `query(sql, bind?)` | Rows as objects. Read-only: a write throws. |
| `tables()` | Every table with its columns (`name`, `type`, `notNull`, `primaryKey`) |
| `download(filename, data)` | Saves a `Blob` or string on the user's computer |

Query the `…View` views (`tallyView`, `bagUpView`, `blockView`…): each holds
only the live version of every row. `table(title, rows)` from
`src/plugin/table` draws rows as the built-in tabs do.

The reports in `src/reports.ts` are the public contract: their columns only gain, never change. Raw tables change between versions.

Every tree count Ops shows carries the white pine, as Get Cache's does. A report gets it by naming the column for
trees (`trees`, `planted`, `allocated`, `delivered`… — `TREE_NAME` in `src/app/trees.ts`); a chart or plugin writes
`trees(n)` or `TREE`. Never recolour it: it sits only in white text.

## Refusals

In place of its content, a tab says why it won't run when its `api` is not
this Ops's major or the open file's schema is older than its `minSchema`. The
Get Cache schema only adds tables and columns, so a plugin built for 57 keeps
working on every newer file.

## Versions

Within a major, `ops` only gains members; changing or removing one is a new
major, listed here.

- **1.0.0** — `apiVersion`, `schemaVersion`, `query`, `tables`, `download`.
