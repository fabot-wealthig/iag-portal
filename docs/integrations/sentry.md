# Sentry (frontend error monitoring)

Added 2026-09-04 (chat 9). Sentry is the portal's only **frontend-side** external integration — every other integration this portal has is consumed by the edge function. Its sole job is to capture uncaught JavaScript/React errors from the deployed SPA, so a render crash that today vanishes into a blank white screen produces a report instead.

Ported from VFO, which has run the same wiring since 2026-06-18.

## What's wired

| Where | What |
|---|---|
| `package.json` / `package-lock.json` | dependency `@sentry/react` |
| [`src/main.jsx`](../../src/main.jsx) | `Sentry.init({ dsn: SENTRY_DSN, environment: 'production', enabled: import.meta.env.PROD && SENTRY_DSN !== '', ignoreErrors: [...] })` at startup, before the app renders |
| [`src/components/ErrorBoundary.jsx`](../../src/components/ErrorBoundary.jsx) | wraps the whole app; `componentDidCatch` calls `Sentry.captureException(error, { extra: { componentStack } })` |

The boundary's fallback is a plain card — "Something went wrong" and a Reload button — styled with literal hex rather than the `--wig-*` variables, because a stylesheet that failed to load is one of the ways an app gets here.

## The DSN is empty until Jake pastes it

`src/main.jsx` holds:

```js
const SENTRY_DSN = ''
```

Nothing is reported while that string is empty: `enabled` is false, so `Sentry.init` installs no handlers at all. Jake creates the Sentry project, copies its DSN, and pastes it into that one line; the next `npm run deploy` starts the reporting.

A Sentry DSN is a **public, ingest-only** address — it can only *send* error reports to one project, never read anything back. It is safe in client source, the same way the Supabase anon key is, which is why it is a literal in `main.jsx` and not an environment variable. VFO does exactly the same. Rotating it (Sentry's "new client key") means editing this line and redeploying.

## Scope (deliberately minimal)

- **`enabled: import.meta.env.PROD && SENTRY_DSN !== ''`** — production builds only. Without the `PROD` half, a `npm run dev` session reports every hot-reload error of half-written code, tagged `environment=production`; VFO triaged nine phantom "production" issues from exactly that before adding it (2026-07-08). Vite sets `PROD` in `vite build`, which is what `npm run deploy` ships.
- **`ignoreErrors: [/non ISO-8859-1 code point/]`** — browser-extension fetch calls surfaced through Sentry's own breadcrumb wrapper and misattributed to the app bundle. No fetch in `src/` puts dynamic data in a header, so this pattern can only be somebody else's code.

There is intentionally:

- **No Session Replay** — it would record the DOM and every input, which on this portal means client names, emails and payment amounts.
- **No performance tracing / `tracesSampleRate`** — not needed, and it keeps the project inside Sentry's free tier.

So Sentry receives error events only — the global handler plus the explicit `captureException` from the boundary — and only from production builds. It never sees normal user activity, network payloads, or session data.
