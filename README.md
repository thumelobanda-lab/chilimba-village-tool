# Chilimba Village Tool — starter scaffold

A Vite + React PWA, styled as a clean spreadsheet grid matching the
Hillcrest Chilimba tracker, with a subscription gate (K25/cycle,
paid by mobile money).

## Run it locally

```
cd chilimba-pwa
npm install
npm run dev
```

Opens at http://localhost:5173. Everything currently runs in **mock mode**:
login, the shared schedule, contributions, and subscriptions are all stored
in the browser's localStorage. No backend required to try it.

## Running the tests

```
npm test              # frontend logic — ledger math, schedule rules, fund crediting
cd worker && npm test  # Worker logic — reminder sweep, request routing
```

Both suites are logic tests, not full end-to-end coverage — they cover
the parts most likely to silently break in a way that costs a member
real money (due-amount resolution, append-only payment math, the fund
auto-crediting rule, the biweekly reminder sweep). Worth running before
any change that touches `src/lib/` or `worker/src/`.

## What's included

- `src/App.jsx` — composition root only: wires the hooks below together
  and renders the tab shell. State and business logic live in the hooks,
  not here — see `src/hooks/`
- `src/hooks/` — `useSession` (login/logout/create-group), `useGroupConfig`
  (schedule loading, scoped to the signed-in member's group), `useLedger`
  (ledger state + every payment/payout/override mutation + derived
  totals), `useOnboarding` (the one-time new-member rate prompt)
- `src/components/Login.jsx` / `CreateGroup.jsx` — sign in with a group
  code + name + PIN, or start a brand-new group as its founding admin
- `src/components/LedgerTable.jsx` — the 7-column spreadsheet grid, with
  each "Amount Paid" cell expandable into an **append-only payment
  history** — every logged payment is its own timestamped entry;
  corrections are made by voiding an entry (kept visible, struck through)
  and logging a new one, never by overwriting a figure
- `src/components/Subscription.jsx` — K25/cycle mobile money paywall
- `src/components/GroupSetup.jsx` — admin-only schedule editor
- `src/lib/api.js` — the data layer, with `MOCK_MODE`. Every function
  matches a real route implemented in `worker/src/routes/`
- `src/lib/adminConfig.js` — mock-mode-only admin shortcut for local
  testing (see below) — not how admin access works on the real backend
- `worker/` — the real Cloudflare Worker + D1 backend, already written
  and **multi-tenant**: one deployment can host many independent Chilimba
  groups, each identified by a short group code typed at login alongside
  name + PIN (no per-group subdomain or URL routing)

## Multi-tenancy — how groups work

- **Creating a group** is self-service: on the login screen, "Starting a
  new Chilimba group? Create one" walks through group name, group code,
  your name, and a PIN. Whoever creates a group becomes its first admin
  automatically — there's no platform superadmin to bootstrap an
  otherwise-empty group any other way.
- **Signing in** to an existing group needs three things: the group code,
  your name, and your PIN. The same name can exist in two different
  groups as two completely separate accounts (verified live — two
  accounts both named "Harriet" in different groups, different PINs,
  completely isolated payment histories).
- **Promoting a second admin** for a group that already exists is
  self-service too — any current admin can promote another member from
  the "Admins" section of Group Setup. The safeguard: a group can never
  be left with zero admins — demoting the last one is blocked both in
  the UI and re-checked server-side (see `wouldLeaveZeroAdmins` in
  `worker/src/adminUtils.js`).
- **Every route in `worker/src/routes/`** derives its group scope from
  the authenticated session (`user.groupId`), never from a client-supplied
  group id or slug. A route that trusted a client-supplied value would let
  one group read or write another's data — this is the single invariant
  that keeps groups isolated. Promotion follows the same rule: an admin
  can only promote or demote members of their own group.

## Setting admins (mock mode only)

`src/lib/adminConfig.js` is a developer shortcut for testing locally — it
does not reflect how the real backend works. Open the file and
uncomment/add up to a couple of names:

```js
export const ADMIN_NAMES = ["Harriet", "Doreen"];
```

Then restart `npm run dev`. On the real backend, becoming the first admin
of a group happens by creating it; promoting another admin for a group
that already exists is done from inside the app itself, by an existing
admin — see `PRIVACY.md` for the full model.

## Setting up reminders

This is a biweekly Chilimba, so reminders check daily but only actually
notify a member on the day their configured lead time (default 2 days)
matches an upcoming due date.

**Push notifications** work fully once VAPID keys exist:

```
npx web-push generate-vapid-keys
```

Put the public key in `worker/wrangler.toml` under `[vars] VAPID_PUBLIC_KEY`
and in a `.env` file in the project root as `VITE_VAPID_PUBLIC_KEY=...`
(the frontend needs it to subscribe). Set the private key as a secret:

```
npx wrangler secret put VAPID_PRIVATE_KEY
```

**SMS reminders** need a real gateway account — see the comments in
`worker/src/sms.js`. Africa's Talking is the common choice for Zambian
numbers. Until a key is set, SMS sends are silently skipped (logged, not
sent) so nothing breaks in the meantime.

The cron trigger is already declared in `worker/wrangler.toml`
(`[triggers] crons = ["0 6 * * *"]`) — it activates automatically once you
`wrangler deploy`.

## Deploy — the fast path

Three scripts cover the whole backend + frontend deployment instead of
typing each command by hand:

```
chmod +x scripts/*.sh        # first time only

./scripts/setup-local.sh     # npm install, both app and worker
./scripts/deploy-backend.sh  # login, D1, schema, VAPID keys, deploys the Worker
./scripts/deploy-frontend.sh # builds, deploys to Pages, fixes CORS automatically
```

You'll still see the Cloudflare login open a browser tab — that step can't
be scripted away — but everything else (copying database IDs and VAPID
keys into config files, writing `.env`, flipping `MOCK_MODE`, wiring CORS
to match your real Pages URL) happens for you. Run them in that order,
each from the project root.

Once your admins have logged into the live app at least once:

```
./scripts/set-admin.sh harriet
```

Mobile money and SMS keys aren't part of the scripts, since they depend on
whichever provider you sign up with — set them when ready:

```
cd worker
npx wrangler secret put MOMO_API_KEY
npx wrangler secret put SMS_API_KEY
```

## Deploy — the manual path

If you'd rather see each step explicitly (or the scripts hit something
environment-specific), here's what they're doing under the hood.

The Worker is already written — `worker/src/index.js` implements every
route `src/lib/api.js` expects, matching the append-only payments model:

```
cd worker
npx wrangler login
npx wrangler d1 create chilimba-db
```

Copy the `database_id` it prints into `worker/wrangler.toml`, then:

```
npx wrangler d1 execute chilimba-db --file=./schema/schema.sql
npx wrangler deploy
```

Set `ALLOWED_ORIGIN` in `wrangler.toml` to your real Pages URL once you have
one, and set any mobile money aggregator key as a secret — never in the repo:

```
npx wrangler secret put MOMO_API_KEY
```

Then in the frontend: set `MOCK_MODE = false` in `src/lib/api.js` and point
`VITE_API_BASE` (in a `.env` file) at your deployed Worker URL:

```
VITE_API_BASE=https://chilimba-worker.YOUR-SUBDOMAIN.workers.dev
```

Finally, deploy the frontend itself:

```
npm run build
npx wrangler pages deploy dist
```

### Making someone an admin on the real backend

Admin status is a column in the `users` table, set directly — never through
an API route:

```
npx wrangler d1 execute chilimba-db --command "UPDATE users SET role='admin' WHERE name='harriet';"
```

(`adminConfig.js` in the frontend only applies to mock mode — once
`MOCK_MODE = false`, the Worker's `role` column is the source of truth.)

## Mobile money — important reality check

You cannot collect MTN Money / Airtel Money payments directly from a phone
number the way this mock simulates. Real collection requires **one of**:

1. **A payment aggregator** that already has Zambian mobile money rails —
   e.g. Flutterwave, Paychangu, DPO, Lenco. You sign up as a merchant, they
   give you an API key, your Worker calls their "charge" endpoint, they
   handle the USSD prompt and settlement, and pay out to your bank account
   on a schedule.
2. **Direct carrier APIs** (MTN MoMo Collections API, Airtel Money Open
   API) — these require a registered business account with that carrier,
   a merchant code, and typically a KYC/compliance process. More control,
   more setup.

For a small village-tool project, an aggregator (option 1) is almost always
the faster path — you get one API instead of three, and they carry the
compliance burden. Whichever you pick, replace
`initiateSubscriptionPayment()` in `src/lib/api.js` with a call into your
Worker, and have the Worker hold the actual provider credentials — never
ship a mobile money API key inside the frontend bundle.

## Later: Android app

Once this is deployed on a real `https://` domain with a working manifest:

```
npm install -g @bubblewrap/cli
bubblewrap init --manifest=https://yourdomain.com/manifest.json
bubblewrap build
```

Open the generated project in Android Studio to sign and produce the APK/AAB.
