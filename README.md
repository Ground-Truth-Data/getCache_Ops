# getCache_Ops
## Build your own Ops

Get Cache Ops opens a planter's Get Cache file in your browser and shows it as
tables and charts. Nothing is uploaded: the file never leaves the computer it
is opened on, and you only ever see a file a planter chose to send you.

### How a planter sends you their file

In Get Cache the planter opens Account and taps Backup. Their phone shares a
file like `261101Sam.backup.getCache` holding everything on it; they send it
by AirDrop, email, Messages or a shared drive. Open it with "Open a Get Cache
file" or drop it on the page.

### Make your copy

Create an empty private repo (or fork, if your Ops can be public), then:

    git clone https://github.com/Ground-Truth-Data/getCache_Ops jrp-ops
    cd jrp-ops
    git remote rename origin upstream
    git remote add origin <your private repo URL>
    git push -u origin main
    npm ci && npm run dev

Install with `npm ci`, never `npm install`: it leaves `package-lock.json`
untouched, and a changed lockfile blocks `git pull upstream main`.

### Your changes go in `custom/`, nowhere else

Your name, logo and colour go in `custom/brand.ts` and your reports in
`custom/reports/`; `custom/README.md` shows both. Upstream never touches
`custom/`, so `git pull upstream main` never conflicts.

### Units go in the header, once

Every table says its unit once, in the column header: tree counts carry the
pine, money reads `value ($)` or `per tree ($)`, and each cell is a plain,
right-aligned number. Canadian dollars are `$`, never `CA$`; another dollar
says whose (`US$`). Rows in more than one currency split into one table per
currency, each with its own header and its own sums, because dollars and
pounds never add up. Exports follow the same headers. A query only has to
name its columns (`trees`, `value`, `per tree`) and return a `currency`
column; `src/app/DataTable.svelte` does the rest.

### Put it online

Push to GitHub, import the repo on Vercel and press Deploy. No settings, no
server, no database; Vercel's free plan is enough.

### Send an improvement back

Need a change outside `custom/`? Make it in a public fork of getCache_Ops and
open a pull request. Once merged, every company gets it on its next
`git pull upstream main`.
