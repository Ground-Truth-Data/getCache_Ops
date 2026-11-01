# getCache_Ops
## Build your own Ops

Get Cache Ops opens a planter's Get Cache file in your browser and shows it as
tables and charts. Nothing is uploaded: the file never leaves the computer it
is opened on, and you only ever see a file a planter chose to send you.

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

Your name, logo and colour go in `custom/brand.ts` and your tabs in
`custom/plugins/`; `custom/README.md` shows both. Upstream never touches
`custom/`, so `git pull upstream main` never conflicts.

### Put it online

Push to GitHub, import the repo on Vercel and press Deploy. No settings, no
server, no database; Vercel's free plan is enough.

### Send an improvement back

Need a change outside `custom/`? Make it in a public fork of getCache_Ops and
open a pull request. Once merged, every company gets it on its next
`git pull upstream main`.
