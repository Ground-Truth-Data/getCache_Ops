# Report API

A company report is one JavaScript file at the company's own address, listed in
`custom/reports/<id>.json` (`custom/README.md`). To start one, follow
`src/starters/report/README.md`.

## The box

Ops runs the file as the only script of a sandboxed page: no network of any
kind, no `eval`, no frames, workers, forms, popups, cookies or sign-in, and no
reach into the Ops page. Images only from `data:` and `blob:`. The first time a
user opens the tab, Ops shows which tables it asks for and waits for Allow.

## Talking to Ops

| You post to `parent` | Ops posts back |
|---|---|
| `{ id: 1, rows: 'tallyView' }` | `{ id: 1, rows: [...] }`, or `{ id: 1, error }` for a table your manifest doesn't list |

Rows are the signed-in user's own, exactly as Ops' built-in reports see them.

When the user presses Export, Ops posts `{ export: true }`; answer with
`{ file: { name: 'payroll.csv', text } }` and Ops saves it. Print prints the page
with your report in it.

Query the `…View` tables (`tallyView`, `bagUpView`, `blockView`…): each holds
only the live version of every row, and nothing deleted. Their columns only
gain, never change. `schema/v57.json` lists every table and view with its
columns; both it and `schema/v57.sql` are generated from Get Cache's own schema.

## Changes

- **9 Nov 2026:** the views read Get Cache's own live rule, so a thing deleted
  on the phone is gone instead of showing its last version. The version tables
  gain `replacesKey`.
- **10 Nov 2026:** every version row says what it is: `kind` (`edit`, `accept`,
  or `end`, a delete) and `actKey`, the act that wrote it. The old ended stamp
  and delete flag are gone. `orgKindTable`'s own kind is `orgKind`, and
  `deliveryTable`'s is `deliveryKind`.

Every tree count Ops shows carries the white pine, as Get Cache's does; draw it
beside yours.
