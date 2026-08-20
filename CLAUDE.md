# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Chilimba Circle — a Vite + React PWA for tracking a Zambian-style
Chilimba (rotating savings circle): a shared payout schedule, per-member
append-only contribution ledger, a K25/cycle mobile-money subscription
gate, community fund tracking, loans, and push/SMS reminders. Multi-tenant:
one deployment hosts many independent groups, each keyed by a group code
typed at login alongside name + PIN. Backend is a Cloudflare Worker + D1.

## Commands

```
npm install                  # frontend deps, from repo root
npm run dev                  # vite dev server at http://localhost:5173
npm run build                # production build
npm run lint                 # eslint src/
npm test                     # vitest run — frontend logic only (src/**/*.test.js)
npx vitest run src/lib/ledgerMath.test.js   # run a single frontend test file
npx vitest run -t "some test name"          # run tests matching a name

cd worker && npm install     # worker deps
cd worker && npm test        # vitest run — worker logic (node environment)
cd worker && npx vitest run src/reminders.test.js   # single worker test file
cd worker && npm run dev     # wrangler dev (local Worker + D1)
```

Frontend and worker are two separate npm projects/vitest configs (root
`vite.config.js` test block explicitly excludes `worker/`, and
`worker/vitest.config.js` is separate) — running `npm test` from root
never runs worker tests and vice versa. Both suites are logic tests, not
end-to-end coverage: they target the parts most likely to silently cost a
member real money (due-amount resolution, append-only payment math, fund
auto-crediting, the reminder sweep). Run both before any change touching
`src/lib/` or `worker/src/`.

## Mock mode vs. real backend

`src/lib/api/core.js` exports `MOCK_MODE` (currently `true`). In mock
mode every read/write goes to `localStorage`, scoped per-group and
per-member via `groupScopedKey()` — no backend needed to develop or test
the frontend. Setting `MOCK_MODE = false` and pointing `VITE_API_BASE`
(via `.env`) at a deployed Worker switches every function in `src/lib/api/`
to call the real routes in `worker/src/routes/` instead — the two paths
are kept in 1:1 correspondence by function name, so a new capability
needs a matching mock branch *and* Worker route, not one or the other.

`src/lib/adminConfig.js` (`ADMIN_NAMES`) is a mock-mode-only dev shortcut
for granting admin locally — it has no effect once `MOCK_MODE = false`,
where the Worker's `users.role` column is the sole source of truth.

## Architecture

**Frontend state lives in hooks, not components.** `src/App.jsx` is a
composition root: it wires hooks together and renders the tab shell, but
holds no business logic itself.

- `src/hooks/useSession.js` — login / logout / create-group
- `src/hooks/useGroupConfig.js` — schedule + config, scoped to the
  signed-in member's group
- `src/hooks/useLedger.js` — ledger state and every payment/payout/override
  mutation, plus derived totals (delegates the actual math to
  `src/lib/ledgerMath.js`, a pure function so it's unit-testable without
  rendering anything)
- `src/hooks/useOnboarding.js` — one-time new-member rate prompt

**API layer is domain-split but re-exported from one place.**
`src/lib/api.js` is just `export * from "./api/<domain>.js"` for auth,
schedule, contributions, funds, members, reconciliation, reminders,
subscription, notices — so every component keeps importing from
`"../lib/api.js"` regardless of which domain module actually implements a
given call. `src/lib/api/core.js` holds `MOCK_MODE`, `API_BASE`, and the
shared localStorage/key-scoping plumbing every domain module depends on.

**Ledger data model is append-only.** A payment is never overwritten to
correct it — it's voided (kept visible, struck through, `voidedAt` set)
and a new entry logged. This is deliberate: `src/lib/ledgerMath.js` and
`voidPayment`/`addPayment` in `useLedger.js` assume this invariant, and
the Worker's contributions routes must preserve it too.

**Worker mirrors the frontend's domain split.** `worker/src/index.js`
wires a small custom router (`worker/src/router.js`, supports `:param`
segments) to per-domain route registrars in `worker/src/routes/` (auth,
groups, schedule, contributions, subscription, reminders, push, funds,
admin, notices) — one registrar per `src/lib/api/*.js` module, by design.
Each handler gets `{ request, env, ctx, url, params, cors }` and returns
a `Response` via `json()` from `worker/src/responses.js`. Errors thrown as
`HttpError` (see `worker/src/httpError.js`) propagate their status/message
to the client; anything else is logged server-side and masked as a
generic 500 (never leak internal error detail — see the try/catch in
`worker/src/index.js`).

**Group isolation is the one security invariant that matters most.**
Every Worker route derives its group scope from the authenticated
session (`user.groupId`), never from a client-supplied group id/slug — a
route that trusted a client value would let one group read or write
another's data. The same rule applies to admin promotion/demotion
(`worker/src/adminUtils.js`): an admin can only act on members of their
own group, and a group can never be left with zero admins
(`wouldLeaveZeroAdmins`, enforced both client-side and re-checked
server-side). See `PRIVACY.md` for the full data/security model,
including PIN hashing (PBKDF2-SHA256, 120k iterations, per-account salt —
`worker/src/crypto.js` / `src/lib/crypto.js` for the mock-mode
equivalent) and mobile-money number masking.

**Reminders** run off a daily Cloudflare cron trigger
(`worker/wrangler.toml` `[triggers]`, calling `scheduled()` in
`worker/src/index.js` → `runReminderSweep` in `worker/src/reminders.js`)
but only actually notify a member when their configured lead time matches
an upcoming due date — the schedule itself is biweekly, the sweep is
daily. Push uses VAPID (`worker/src/push.js`, `src/lib/push.js`); SMS
(`worker/src/sms.js`) silently no-ops until a real gateway key is
configured, by design, so nothing breaks in the meantime.

**PWA / service worker**: `vite-plugin-pwa` runs in `injectManifest`
mode against `src/sw.js` (not `generateSW`) — service worker logic is
hand-written there, not autogenerated, so changes to caching/offline
behavior go in that file directly.

## Conventions

- ESLint (`eslint.config.js`) enforces `no-undef` and
  `react-hooks/rules-of-hooks` as hard errors — both catch real bugs (an
  undeclared variable reaching JSX/prod, or hooks called conditionally),
  not style preferences. The newer React-19-compiler-era hooks rules
  (set-state-in-effect, use-memo, purity, etc.) are deliberately **not**
  enabled — they flag this codebase's intentional fetch-on-mount pattern
  as an error and would demand risky rewrites of working code for a
  stylistic concern. Don't turn them on without discussing it first.
- Business-logic modules under `src/lib/` and `worker/src/` favor pure,
  dependency-free functions with a colocated `*.test.js` — this is what
  makes them unit-testable without a browser or a live Worker. Keep new
  logic in that shape rather than folding it into components/route
  handlers directly.
- Secrets (mobile money keys, VAPID private key, SMS gateway key) are set
  via `wrangler secret put`, never written to `wrangler.toml` `[vars]`
  (plaintext in the repo) or committed anywhere.
- `scripts/setup-local.sh`, `scripts/deploy-backend.sh`,
  `scripts/deploy-frontend.sh` automate the full local-setup and deploy
  flow (D1 creation, schema, VAPID keys, CORS, `.env` wiring) — prefer
  these over hand-running the equivalent `wrangler`/`npm` commands when
  asked to set up or deploy the project. `scripts/set-admin.sh <name>`
  promotes a member to admin on the real (non-mock) backend.
- Schema migrations in `worker/schema/migrations/` are purely additive
  and only needed against an *already-deployed* database — a fresh
  `schema.sql` already includes everything they add.
