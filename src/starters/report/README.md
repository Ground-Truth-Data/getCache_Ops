# Make your own plugin

A plugin is a report tab: one JavaScript file your company hosts, plus one line
of JSON in your copy of Ops. This folder is a working one to start from.

1. **Copy `report.js`** into your own repo, public or private. It asks Ops for
   `bagUpView` and `tallyView` and draws trees per day. Change what it asks for
   and what it draws; `schema/v57.json` lists every table and its columns.
2. **Host it** at an `https` address your Ops can fetch. Ops downloads the
   file each time the tab opens, so the host must answer Ops' origin with
   CORS (`Access-Control-Allow-Origin`). A login in front of it is fine.
3. **List it**: copy `report.json` to `custom/reports/<id>.json` in your Ops,
   set `url` to the address from step 2, and name every table it reads in
   `tables`. Ops refuses any table not listed there.
4. **Open Ops.** The new tab asks the user to Allow the tables once, then runs
   your file.

In `npm run dev` Ops already shows this folder's `report.js` as "Sample
report", so you can edit it and reload to see each change.

What the file may do, and the messages it trades with Ops: `PLUGIN_API.md`.
