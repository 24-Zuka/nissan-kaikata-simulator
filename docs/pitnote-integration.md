# PITNOTE integration build and tests

`pitnote/` contains the reviewed static PITNOTE source, without customer records or generated CarPlan bundles. Customer data remains in each browser's existing IndexedDB database.

Run `npm ci`, `npx playwright install chromium`, and `npm run test:e2e` from a fresh checkout. The test command builds the same-origin CarPlan iframe and packages it with the pinned PITNOTE source in `dist-pitnote/`. The local test server reads that generated directory and applies its `_headers`. It needs no neighboring repository, production credential, or live customer data.

`npm run build` still builds the standalone authenticated Vercel app with that project's existing environment. `npm run build:pitnote` builds the separate Cloudflare Pages distribution, with the iframe at `/carplan/embed.html`. The generated `dist-embed/` and `dist-pitnote/` directories are ignored by Git. Publish the contents of `dist-pitnote/` only to the existing PITNOTE Pages project after the authorized release checks.

The PITNOTE source was imported from the reviewed 2026-10-17 distribution. Keep subsequent PITNOTE source changes in this directory so integration CI and the distribution use the same revision.
