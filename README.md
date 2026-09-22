# IAG Portal

Frontend for the IAG Portal — Innovation Advisory Group's admin portal for managing centres of
influence (COIs). Built with Vite and React.

Live at **https://portal.wealthig.com** (GitHub Pages, served from the `gh-pages` branch).

"Wealth IG" / "WIG" survive only as infrastructure names: the domain, the email addresses, the
`--wig-*` CSS tokens and the storage keys. Nothing user-facing says them.

Documentation lives in `docs/` — start with `docs/SESSION_REFERENCE.md`, the hub. The session
prompts pasted at the start and end of each chat live in `docs/prompts/`.

Adding a route means TWO edits: the route in `src/App.jsx` AND the path in the `ROUTES` array in
`scripts/emit-route-pages.mjs`. Any path someone reaches from a pasted link needs the second one or
it serves a real 404.

> **`npm run deploy` is a PRODUCTION deploy.** It runs a vite build and publishes to `gh-pages`,
> which is the live site. There is no staging environment. Never run it without explicit approval.
