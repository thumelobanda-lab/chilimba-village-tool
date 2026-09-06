# Mobile Money Integration — Scope & Decision Document

Status: research/scoping only. No code, routes, or schema changes included
or implied by this document. Written September 2026 for a go/no-go and
sequencing call on real MTN Money / Airtel Money integration in OpenBook.

## Why this matters here specifically

OpenBook's payment flow today is entirely self-reported: a member taps
"log a payment" (`POST /api/contributions/payments`, inserted as
`status = 'pending'`), and it counts for **nothing** — not toward
due/paid/balance, not toward community-fund crediting — until an admin
manually confirms it (`POST /api/admin/payments/:id/confirm` in
`worker/src/routes/admin.js`). That two-step "claim, then verify" shape
also already exists for the group subscription charge
(`worker/src/routes/subscription.js`'s `/api/subscription/charge`,
confirmed by a platform owner) — it was put there specifically *because*
an earlier version of that endpoint auto-activated on a self-reported
claim with no real gateway behind it, and two groups exploited that to
get free access. That history is directly relevant: any MoMo integration
that removes the human-confirmation step needs to replace it with an
equally trustworthy verification, not just a "trust the client" shortcut
with a different UI.

## 1. Providers

### Genuinely viable for Zambia today

| Option | Zambia support | What it is |
|---|---|---|
| **MTN MoMo API (Collections product)** | Yes — MTN's Open API platform has operated in Zambia since ~2019–2022, with `momodeveloper.mtn.com` as the developer portal. | Direct integration with MTN's own wallet network. |
| **Airtel Money API (Collections)** | Yes — Airtel's pan-African Open API (`developers.airtel.africa`) covers 14+ markets including Zambia; sign-up/KYC is per-country. | Direct integration with Airtel's own wallet network. |
| **DPO Group (DPO Pay)** | Yes — has a Zambia-specific product page (`dpogroup.com/online-payments/zambia`), local Lusaka office, settles to a Zambian bank account in ZMW, and covers **both** MTN MoMo and Airtel Money plus cards behind one integration/checkout. | Zambia-headquartered-presence aggregator; the most-cited "just use this" option in local dev guides (per imbra.co.zm, a Zambian dev resource, and DPO's own site). |
| **Flutterwave** | Yes, as of **late February 2025** — Flutterwave was granted a Payment System licence by the Bank of Zambia and now supports MTN, Airtel, and Zamtel mobile money collection for Zambian merchants by default. This is newer than most people's mental model of Flutterwave (which used to be Nigeria/Ghana/Kenya-centric). | Pan-African aggregator, now properly licensed in Zambia, not just "reachable from" Zambia. |

### Marketed as Africa-wide but do NOT actually cover Zambia

- **Paystack** — as of this research, Paystack's officially supported
  merchant countries are Nigeria, South Africa, Ghana, Kenya, and Côte
  d'Ivoire (with Egypt and Rwanda as recent expansions reported in
  press). Zambia is not on that list. A Zambian business cannot open a
  standard Paystack merchant account today. Rule it out.
- **PayChangu** — despite regional marketing and occasional mentions
  alongside Zambia, PayChangu is a Malawi-headquartered fintech whose
  primary licensed market is Malawi (Airtel Money, TNM Mpamba). Not a
  real Zambia option; don't be misled by "Zambia and Malawi" mentions in
  fintech-roundup articles — those are usually about a fintech-news
  *event* covering both countries, not actual Zambian merchant coverage.
- **Kazang Pay** — real and Zambia-present, but it's a **card-acquiring
  / POS terminal** product (tap-to-pay on physical Kazang terminals),
  not an API for triggering a mobile money prompt from a web/PWA client.
  Wrong shape for this use case; not comparable to the others here.

### Recommendation on provider choice

For a from-scratch integration where the driving cost concern is "fees
eat into members' actual contributions," direct MTN + Airtel APIs win on
fee structure (see §3) but cost more in integration and compliance
effort (two separate KYC processes, two separate SDKs/webhook shapes).
DPO is the pragmatic middle ground already recommended by local Zambian
dev resources: one integration, one settlement account, covers both
networks, Zambia-based support. Flutterwave is viable and newly licensed
but is the least Zambia-native of the four and its published fee (3% on
mobile money collection, see §3) is the highest of the realistic set —
worth a discovery call for volume pricing before ruling in or out.

**Recommended starting point: DPO Pay**, with a fallback plan to move to
direct MTN + Airtel APIs later if DPO's per-transaction fee proves too
costly at scale (a savings-group ledger where every member pays K25–K100+
per cycle is exactly the kind of low-ticket, high-frequency volume where
a percentage fee compounds fastest — see §3).

## 2. Go-live requirements per option

All four viable options require, at minimum, a **registered Zambian
business** — none of these can be used indefinitely under an individual/
sole-proprietor identity for a production merchant account, though
sandbox access does not require this (see §4). Concretely, expect:

- **PACRA business registration** (Patents and Companies Registration
  Agency) — a Certificate of Incorporation or equivalent.
- **ZRA TPIN** (Zambia Revenue Authority Taxpayer Identification
  Number) — generated automatically alongside PACRA registration for
  businesses registered post-2020, per ZRA/PACRA guidance.
- **KYC documents** proving business ownership/existence — NRC of the
  business owner/director, business certificate, and (for MTN
  specifically) a formal "letter of application."
- **A settlement bank account** in the business's name, in ZMW, held at
  a Zambian bank.

Per-provider specifics:

- **MTN MoMo**: sandbox sign-up is self-service and instant on
  `momodeveloper.mtn.com`. Going live requires using the portal's
  "Go-Live" tab, submitting KYC docs, and — per MTN's own developer
  community guidance — an ongoing back-and-forth with "MoMo KYC" to
  finalize contract terms. No published fixed timeline; expect this to
  be the slowest and least self-service of the four, since it's a
  direct telco relationship rather than a fintech-aggregator
  onboarding flow optimized for third-party developers.
- **Airtel Money**: similar shape — register on
  `developers.airtel.africa`, get `client_id`/`client_secret` in
  sandbox instantly, then apply to **Airtel Zambia specifically** for
  production access and complete KYC. Also a direct telco relationship,
  same caveats as MTN.
- **DPO Pay**: standard PSP onboarding — merchant application, KYC
  docs, contract, then live credentials. DPO explicitly positions
  itself as the lower-friction option for Zambian merchants who don't
  want to run two separate telco KYC processes in parallel — you deal
  with one company, not two telcos.
- **Flutterwave**: Flutterwave's Bank-of-Zambia payment-system licence
  (Feb 2025) means it can legally onboard Zambian merchants directly
  through its standard merchant KYC flow (business docs + settlement
  account), same as any other Flutterwave market. No BoZ-specific extra
  step surfaced in research beyond what Flutterwave already requires
  everywhere.

**Bank of Zambia's role**: BoZ doesn't approve individual merchants —
it licenses the *payment system providers* (MTN, Airtel, DPO,
Flutterwave all operate under BoZ oversight as licensed providers). A
merchant/developer integrating against any of these four is relying on
the provider's existing BoZ licence, not obtaining their own. This is
good news for scope: OpenBook itself does not need to seek a BoZ licence
to accept payments through any of these four — it only needs a
merchant/business relationship with one of them.

## 3. Fees & settlement — why this is the crux of the decision

This is a rotating savings circle. Every member's contribution is
typically K25–K100-ish per cycle (per the group's configured schedule) —
low-ticket, recurring, and the whole point of the product is that the
member's money reaches the group intact. A percentage-based fee is
regressive here in a way it wouldn't be for, say, an e-commerce
storefront selling K500+ items: shaving 3% off a K25 contribution is a
meaningfully different member experience than shaving 3% off a K5,000
purchase, and — critically — **someone has to eat that fee**: either the
member's contribution is short by the fee amount (breaking the ledger's
"paid = due" arithmetic) or the group absorbs it from the community
fund, or OpenBook absorbs it. This needs an explicit product decision
before any provider is chosen, not an afterthought.

What's verifiable from public sources as of this research:

- **Flutterwave, Zambia, mobile money collection: 3% per transaction**
  (per Flutterwave's own Zambia pricing page, `flutterwave.com/zm/pricing`,
  and corroborated by Flutterwave's help-center Zambia page). Payouts
  *to* mobile money separately run ~2%. Pricing excludes VAT and local
  taxes on top. By default the *customer* (i.e., the paying member)
  bears the fee unless the merchant configures otherwise — meaning by
  default a member paying K25 would see something closer to K25.75
  requested, not K25.
- **Airtel Money direct**: publicly published tariffs are **flat fee
  bands, not a percentage**, for consumer-facing transactions (deposit/
  withdraw/transfer) — see Airtel Zambia's own transaction-fees page.
  This is meaningfully different from a percentage fee at OpenBook's
  transaction sizes: flat fee bands tend to be cheaper at low amounts.
  However, the *merchant collections* fee (what a business pays Airtel
  to receive a Collections API payment, as opposed to a customer's
  peer-to-peer transfer) is negotiated per merchant agreement and was
  **not found published** in this research — needs a direct conversation
  with Airtel Zambia's business team to confirm before committing.
- **MTN MoMo direct**: same gap — MTN's merchant/collections pricing
  for Zambia specifically is **not publicly published**; it's set in
  the merchant contract during the Go-Live KYC process. Cannot be
  verified without contacting MTN directly.
- **DPO Pay**: uses custom, per-merchant pricing (a mix of possible
  monthly account fee + percentage + fixed fee depending on the
  negotiated agreement) rather than a published rate card. **Not
  verifiable from public sources** — requires a direct quote from DPO's
  Lusaka office.

**Settlement timing**: Flutterwave publishes 24 hours for local
(Zambian) settlements. DPO settles to a Zambian bank account but no
specific timeline was found published. MTN/Airtel direct-API settlement
timing is also merchant-agreement-specific and wasn't found published.

**Bottom line on fees**: the only concretely comparable, publicly-cited
number in hand is Flutterwave's 3%. Everything else (Airtel and MTN
direct merchant rates, DPO's rate card) requires a direct sales
conversation to pin down — **do not proceed past sandbox/prototyping
without getting a written quote from at least DPO and one direct telco**,
since a fee difference of even 1–2 percentage points compounds
significantly across a group's biweekly cycle over a year. This is the
single most important unresolved question in this whole scope — it
should block the go/no-go call, not just inform it.

## 4. Sandbox availability — can this be built before business registration?

Yes, for all four, with caveats:

- **MTN MoMo**: sandbox is instant self-service at
  `momodeveloper.mtn.com` — sign up, subscribe to the Collections
  product, get subscription keys. Sandbox uses a different base URL
  (`proxy.momoapi.mtn.com`) and **EUR as the sandbox currency** (not
  ZMW) — worth flagging so nobody's confused when sandbox test amounts
  don't look like Kwacha. Full request-to-pay flow, including simulated
  callbacks, is testable pre-registration.
- **Airtel Money**: sandbox (`openapiuat.airtel.africa`) is similarly
  self-service — `client_id`/`client_secret` issued on sign-up, no
  business docs needed to reach the staging/UAT endpoint. Production
  access requires the Zambia-specific KYC application.
- **DPO Pay**: DPO also offers a test/sandbox environment as part of
  standard PSP onboarding practice (consistent with how DPO documents
  its integration flow), though this research did not find a fully
  self-service, no-signup sandbox equivalent to MTN's — likely requires
  at least initiating a merchant application to get test credentials.
  Treat as "probably needs a conversation with DPO first," unlike MTN/
  Airtel's fully open sandboxes.
- **Flutterwave**: Flutterwave's test-mode API keys are available
  immediately on creating a free Flutterwave dashboard account, without
  needing the Zambia business licence step first — this is standard
  Flutterwave practice across all its markets and there's no reason to
  expect Zambia is an exception, though this specific claim was not
  separately re-verified for the just-licensed Zambia entity, only
  inferred from Flutterwave's general onboarding pattern (worth
  double-checking in dashboard signup before relying on it).

**Practical implication**: MTN and Airtel direct integrations are the
most build-ahead-of-paperwork-friendly (fully open sandboxes, no
gatekeeping). This somewhat offsets their downside from §2 (slower
production KYC) — the actual *coding and testing* work doesn't have to
wait on business registration to start, only the final production
cutover does. DPO and Flutterwave likely want at least a lightweight
signup before issuing test credentials, but neither appears to require
completed business registration just to prototype.

## 5. Technical shape on the existing Worker

### Route registrar

Following the existing per-domain pattern (`worker/src/routes/
contributions.js`, `worker/src/routes/subscription.js`) — a new
`worker/src/routes/momo.js` exporting a single
`registerMomoRoutes(router)` function, wired into `worker/src/index.js`
alongside the other `router.use(registerXRoutes)` calls. Conventions to
match:

- Every authenticated handler destructures `{ request, env, params, cors }`
  and starts with `const user = await requireSession(request, env)` (or
  `requireAdmin` where appropriate) — `user.groupId` is the only source
  of group scope, never a client-supplied value (per CLAUDE.md's group-
  isolation invariant).
- Validation failures throw `new HttpError(status, message)` (see
  `worker/src/httpError.js`); handlers never construct raw error
  `Response`s themselves.
- Successful responses go through `json(data, status, cors)` from
  `worker/src/responses.js`.
- Multi-statement writes that must land atomically use `env.DB.batch([...])`,
  matching `contributions.js`/`auth.js`.

Proposed endpoints:

```
POST /api/contributions/payments/:id/momo-charge
```
Member-initiated, `requireSession`. Takes an *existing* pending payment
row (created the normal way via `POST /api/contributions/payments`) and
triggers a Collections request-to-pay against the member's phone number
and network (MTN/Airtel — same shape as `subscription.js`'s existing
`{ phone, network }` body). Stores the provider's transaction reference
against the payment row (needs a new nullable column, e.g.
`momo_reference`, `momo_status` — schema change, out of scope for this
document per the instructions, but flagged here as a dependency) and
returns `{ status: "pending", reference }` immediately, since MoMo
Collections is asynchronous (a 202-style "request sent to phone,
awaiting PIN entry" — not a synchronous success/fail). Reuses the
existing pending payment row rather than inventing a parallel "charge"
concept, so the rest of the ledger code (due/paid/balance) doesn't need
to learn about a second payment shape.

```
POST /api/webhooks/momo/:provider
```
**Unauthenticated by session** (the provider calling this has no
OpenBook session token) — this is a genuinely new shape for this
codebase; every existing route in `worker/src/routes/` requires
`requireSession`/`requireAdmin`. Needs its own authenticity check
instead: MTN and Airtel both support callback-URL configuration
per-subscription, and the request should be verified via a shared
secret/signature the provider includes (exact mechanism is
provider-specific — MTN's callback payload should at minimum be
cross-checked against a stored pending transaction reference before
trusting it, and ideally the callback triggers a **status-poll against
the provider's own transaction-status endpoint** rather than trusting
the webhook body's claimed status outright, per MTN's own documented
async pattern of "callback OR poll, don't trust either alone"). On a
confirmed-success callback, this route:

1. Looks up the payment row by `momo_reference`.
2. Verifies group scope via the row's own `group_id` (not from the
   request, since there's no session to derive it from).
3. Marks the row as MoMo-confirmed (see recommendation below on whether
   this equals `confirmed_at`/admin confirmation or a new intermediate
   state).

```
GET /api/contributions/payments/:id/momo-status
```
Member-initiated poll (`requireSession`, ownership-checked like the
existing `/void` route), for the frontend to show "waiting for you to
approve on your phone..." → resolves once the webhook lands or a
manual status check against the provider succeeds. Needed because the
webhook is not guaranteed to arrive promptly (or at all, if OpenBook's
endpoint is briefly down) — this is the same "callback + poll fallback"
pattern MTN's own docs recommend.

### Does a confirmed MoMo payment skip admin review?

**Recommendation: yes, auto-confirm — but only when the *provider's own
webhook/status-check* confirms success, never on the client's word
alone.** Reasoning:

- The entire reason `payments.status = 'pending'` + admin confirmation
  exists (migration 009, and the identical pattern later applied to
  `group_subscriptions`) is that a **self-reported** claim is
  untrustworthy — a member could claim to have paid K100 and never
  actually send anything. A MoMo Collections success callback is not
  self-reported in that sense: it's an assertion from MTN/Airtel/DPO's
  own systems that money actually moved out of the member's wallet.
  That's strictly stronger evidence than what admin confirmation was
  ever verifying in the first place (an admin confirming a manually-
  logged payment is *also* just trusting the member's word, checked
  against the admin's own memory/bank alerts — a real gateway callback
  is more reliable than that, not less).
- Requiring admin review on top of a verified gateway confirmation adds
  friction with no corresponding safety benefit, and undermines the
  actual product goal here ("tap to pay" should feel instant, not
  "tap to pay, then wait for someone to notice and click confirm" —
  that's barely better than the status quo).
- The failure mode to guard against is a **spoofed or misattributed
  webhook**, not a legitimate one — which is a reason to invest in
  webhook signature verification and reference-based lookups (per §5's
  technical design above), not a reason to keep the human gate.

**What should still require admin review**: anything that arrives via
the *old* self-reported path (`POST /api/contributions/payments` with
no MoMo charge attached) — e.g. a member who paid cash to another
member and someone logs it manually, or a MoMo charge that times out /
fails and the member insists it went through and logs it manually as a
fallback. That path's existing admin-confirmation gate should stay
exactly as-is. The two paths coexist: MoMo-verified payments skip
straight to confirmed; manually-logged ones still need a human. This
also gives the admin a clean signal — a payment with a `momo_reference`
and provider-confirmed status is visibly different from one without,
so an admin auditing the roster can tell at a glance which entries were
gateway-verified versus self-reported, even on the ones that do still
need review.

## 6. Effort estimate & minimum viable version

### Rough sizing

| Phase | Estimate | Notes |
|---|---|---|
| Provider selection + fee confirmation calls | 3–5 business days elapsed (mostly waiting on provider sales/support replies) | Blocking — see §3. Don't start building against a provider whose merchant fee is unconfirmed. |
| Sandbox integration (one provider, request-to-pay + webhook + status poll) | 1–1.5 weeks of dev time | Includes the new route registrar, schema migration for `momo_reference`/`momo_status`, webhook signature verification, frontend "waiting for approval" UI state. |
| Business registration + KYC + production go-live | Highly variable, weeks not days, and **outside developer control** — per §2, MTN's own community docs describe an open-ended back-and-forth during Go-Live KYC. Can run in parallel with sandbox dev work. | |
| Second provider (if DPO + a direct telco, or MTN + Airtel both direct) | +3–5 dev days per additional provider | Mostly webhook-shape differences; the payment-row/ledger side is shared. |
| Hardening: retries, reconciliation job for stuck "pending MoMo" payments, admin visibility into failed charges | 3–5 dev days | Needed before this is trusted with real member money at scale — a request-to-pay that times out silently is a real support burden otherwise. |

**Total for a single-provider MVP, sandbox through production-ready**:
roughly **2.5–3.5 weeks of dev time**, plus an unpredictable KYC/
business-registration wait that can run in parallel but gates the
actual production cutover.

### Minimum viable version — what to build first

Ship a **single provider** (DPO recommended per §1, given it covers
both networks with one integration and one KYC process — this halves
the "which provider" surface area for a v1) with:

- The `momo-charge` endpoint reusing the existing pending-payment row.
- Webhook confirmation → auto-confirm (per §5's recommendation),
  falling back to the existing manual admin-confirm path if the charge
  fails, times out, or the member cancels on their phone.
- A simple "Pay by mobile money" button next to the existing "log a
  payment" entry point in the payment UI — **not a replacement** for
  manual logging, an addition alongside it, so cash/other payment modes
  still work exactly as today.
- Basic status polling in the frontend so the member sees "check your
  phone" → "confirmed" / "failed, try again or log manually" states.

**Defer to a later phase**:
- A second provider/direct-telco integration (only pursue if DPO's
  fees prove too high once quoted — see §3).
- Automatic retry/re-request if a charge times out (v1 can just let the
  member retry manually).
- Any reconciliation dashboard beyond what the existing pending-payments
  admin queue already shows.
- Disbursements (paying a member's payout *out* via MoMo) — this
  document and its recommendation are scoped to **collections only**
  (member → group), matching the task's framing ("member taps to pay").
  Disbursement is a materially different regulatory/product surface and
  should be its own separate scoping exercise if it's ever wanted.
