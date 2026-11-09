# Report API

A company report is one JavaScript file at the company's own address, listed in
`custom/reports/<id>.json` (`custom/README.md`). Copy `src/starters/report/report.js`.

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
only the live version of every row. Their columns only gain, never change.

Every tree count Ops shows carries the white pine, as Get Cache's does; draw it
beside yours.
