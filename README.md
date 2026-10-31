# getCache_Ops
## Build your own Ops

Get Cache Ops opens a planter's Get Cache file in your browser and shows it as
tables and charts. Nothing is uploaded: the file never leaves the computer it
is opened on, and you only ever see a file a planter chose to send you.

### Fork or clone

- **Fork** on GitHub if your Ops can be public. Sending improvements back is
  one click.
- **Clone into a private repo** if you will add private code (payroll, client
  reports). Create an empty private repo, then:

      git clone https://github.com/Ground-Truth-Data/getCache_Ops jrp-ops
      cd jrp-ops
      git remote rename origin upstream
      git remote add origin <your private repo URL>
      git push -u origin main

### Get updates

    git remote add upstream https://github.com/Ground-Truth-Data/getCache_Ops   # once; a clone made as above already has it
    git pull upstream main

### The one rule: your changes go in `custom/`

Everything you make lives in `custom/`: your name, logo and colours in
`custom/brand.ts`, and your own pages and reports in `custom/plugins/`. Never
edit anything outside `custom/`. Upstream never touches `custom/`, so
`git pull upstream main` never conflicts. If you need a change outside
`custom/`, send it back (below) so everyone gets it.

### Put it online

Push your repo to GitHub, import it on Vercel and press Deploy. No settings,
no server, no database. It is free on Vercel's hobby plan.

### Send an improvement back

1. Fork getCache_Ops on GitHub (public).
2. Copy your fix into the fork. Only core files, never `custom/`.
3. Open a pull request. Merged fixes reach every company on its next
   `git pull upstream main`.
