# Privacy & Security — Chilimba Village Tool

## What data this app holds

| Data | Who can see it | Where it lives |
|---|---|---|
| Your name | You, and the group config's payout schedule (everyone can see whose payout date it is — that's inherent to a Chilimba) | Session + your own contribution record |
| PIN | Nobody, in plain text — only a PBKDF2 hash (120,000 iterations, unique per-account salt) is stored, and only used to verify future logins | Local hash store / D1 `users` table |
| Amount paid per date, payout received | **Only you** — no route in this app exposes another member's contribution record | Your own contribution record |
| Mobile money number | Sent once, over HTTPS, to initiate a charge. Only the **last 3 digits** are kept afterward, for your own reference | Your own subscription record |
| Phone number for SMS reminders | Only used to send the reminder text. Stored separately from your payment and mobile-money records — a leak of one doesn't expose the other. Full number is necessary here (unlike mobile money) since SMS delivery requires it | Your own reminder preferences record |
| Push subscription (device endpoint + keys) | Used only to deliver notifications to that device. Not shown to any other member | Your own device record |
| Group schedule (dates, payout order, rates) | Everyone in the group — this is meant to be shared, same as the paper schedule | Shared config |
| Community fund settlements (name, fund, amount, date) | Everyone in the group, by design — this is the "Community" tab. It never exposes a member's balance, rate, or full payment history, only that they've settled a given date | Shared, computed from the payment log |
| Loans against a loanable fund (borrower name, amount, status) | Everyone in the group — visible in "Community"; issuing and marking repaid is admin-only | Shared loan record |

## Design rules this app follows

1. **No arbitrary lookups.** There is no function anywhere in `src/lib/api.js` that fetches another member's contributions by name. Every read/write is scoped to the signed-in session (`getMyContributions`, `saveMyContributions`). A backend implementation must enforce this server-side too — check the session token's identity, never trust a `username` field sent by the client.
2. **PINs are never stored or transmitted in plain text** — sent once, over HTTPS, and hashed with PBKDF2-SHA256 (120,000 iterations, a random per-account salt) the moment they reach the Worker; see `worker/src/crypto.js`. A PIN is only 4+ digits, so a single fast hash (even salted) would let anyone who ever read the `users` table brute-force every account in under a second each — PBKDF2 makes each guess deliberately expensive instead. (Mock mode hashes locally in the browser purely because there's no real backend behind it in that mode — see `src/lib/crypto.js` — not because that's how the real deployment works.)
3. **Mobile money numbers are masked at rest.** The full number is only used for the single charge request; the app never keeps it beyond that request.
4. **You can delete your own data.** The "Delete my data" control removes your contribution history and subscription record.
5. **Group-level settings (Group Setup) are admin-only.** In mock mode, `src/lib/adminConfig.js` is a developer testing shortcut. On the real backend, admin status starts with whoever creates a group (automatic) and can be extended from inside the app — any current admin can promote another member of their *own* group from the "Admins" section, and a group can never be left with zero admins (demoting the last one is blocked, both client-side for a responsive UI and re-checked server-side, since the client-side check alone is only a convenience, not a security boundary). No member can promote themselves, and no admin can promote or demote anyone outside their own group — every admin route derives group scope from the authenticated session, never a client-supplied value.

## Before deploying this for real, add on the backend

- **Signed session tokens** (JWT or Cloudflare-signed cookies) instead of the mock's client-trusted session object.
- **Rate limiting** on `/api/login` and `/api/subscription/charge` (Cloudflare has built-in rate limiting rules) to stop PIN-guessing and payment abuse.
- **CORS locked to your real domain** — not `*` — on every Worker route.
- **Secrets via `wrangler secret put`** for any mobile money aggregator API key — never commit it, never ship it in the frontend bundle.
- **Parameterized D1 queries** everywhere (no string-concatenated SQL) to prevent injection.
- **HTTPS only** — Cloudflare Pages/Workers give you this automatically; don't disable it.
- Consider **Cloudflare Turnstile** on the login and payment forms to cut down on bot/abuse traffic.

## What this app deliberately does *not* do

- It does not sell, share, or transmit member data to any third party other than the mobile money aggregator you choose, and only the minimum needed to process a single payment.
- It does not track members across sessions beyond what's needed to show their own ledger.
