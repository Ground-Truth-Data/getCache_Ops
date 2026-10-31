# Plugin API

A plugin is one tab. Put it in `custom/plugins/<name>.ts`; the build picks it
up. The built-in tabs in `src/plugins/` are written against this same API.

```ts
import type { Plugin } from '../../src/plugin/api';

export default {
	id: 'acme-payroll',  // unique and stable
	name: 'Payroll',     // the tab's label
	api: 1,              // the plugin API major it was built for
	minSchema: 57,       // the oldest Get Cache file it understands
	mount(el, ops) {     // draw into el; return the cleanup
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

Read the `…View` views (`tallyView`, `bagUpView`, `blockView`…): each shows only
the live version of every row.

## Refusals

A tab says why it won't run, in place of its content, when:

- its `api` is not this Ops's major, or
- the open file's schema is older than its `minSchema`.

The Get Cache schema only adds tables and columns, so a plugin built for 57
keeps working on every newer file.

## Versions

Within a major, `ops` only gains members. Changing or removing one is a new
major, listed here.

- **1.0.0** — `apiVersion`, `schemaVersion`, `query`, `tables`, `download`.
