-- Chilimba Village Tool — D1 schema (multi-tenant)
-- Apply with: npx wrangler d1 execute chilimba-db --file=./worker/schema/schema.sql
--
-- MULTI-TENANCY DESIGN
-- One deployment can now host many independent Chilimba groups. Each
-- group is identified by a short human-typed `slug` (e.g. "hillcrest"),
-- entered at login alongside name + PIN — there's no per-group subdomain
-- or path, deliberately, to keep this a single Worker + single Pages
-- deployment for however many groups sign up.
--
-- Every table below that used to be implicitly single-group now carries
-- a `group_id`. It is ALWAYS set server-side from the authenticated
-- session (via the user's group_id) — never accepted as a client-supplied
-- value. A route that trusted a client-supplied group_id would let one
-- group read or write another's data; every route in worker/src/routes/
-- derives group scoping from requireSession()/requireAdmin(), not from
-- request params. This is the single most important invariant in this
-- schema — a missed WHERE group_id = ? is a cross-tenant data leak, not
-- just a bug, which is why group_id is duplicated onto each table
-- directly (defense in depth) rather than relying on a join through
-- users every time.
--
-- name/display_name uniqueness moved from global (UNIQUE(name)) to
-- per-group (UNIQUE(group_id, name)) — two different groups can each
-- have their own "Harriet" without collision, matching how a person
-- who's in two different real-world Chilimba groups would naturally
-- want two separate accounts (one per group), not one shared identity.

CREATE TABLE IF NOT EXISTS groups (
  id TEXT PRIMARY KEY,                     -- uuid
  slug TEXT NOT NULL UNIQUE,               -- short, typed at login, e.g. "hillcrest"
  group_name TEXT NOT NULL,
  cycle_name TEXT NOT NULL,
  recipient_exempt INTEGER NOT NULL DEFAULT 1,
  schedule_json TEXT NOT NULL DEFAULT '[]', -- JSON array of {id,date,group,payees,due}
  funds_json TEXT NOT NULL DEFAULT '[]',    -- JSON array of {id,name,amount,loanable}
  payment_info_json TEXT NOT NULL DEFAULT '[]', -- JSON array of where members send
                                             -- biweekly payments: mobile money / bank
                                             -- details, admin-edited, member-visible
  community_fund_deduction REAL NOT NULL DEFAULT 0, -- fixed K amount split off
                                             -- every payment into the community
                                             -- fund once an admin confirms it
                                             -- (see migration 007) — 0 means off;
                                             -- a PREMIUM-only feature (see
                                             -- subscriptionUtils.js) — rejected by
                                             -- PUT /api/schedule on a free-tier group
  subscription_expires_at TEXT,             -- NULL until a platform owner CONFIRMS a
                                             -- real payment (see group_subscriptions'
                                             -- pending/confirmed/rejected workflow,
                                             -- migration 008) — every group without
                                             -- this set is free tier: usable, but
                                             -- capped (FREE_TIER_MAX_MEMBERS) and
                                             -- without premium features
  created_ip TEXT,                          -- cf-connecting-ip at creation — a fraud
                                             -- signal for the owner dashboard (same
                                             -- IP spinning up several groups fast)
  created_by_phone TEXT,                    -- optional, if the creating admin gave one
  suspended_at TEXT,                        -- set by a platform owner; a suspended
                                             -- group's members are all signed out and
                                             -- can't sign back in until unsuspended
  suspended_reason TEXT,
  suspended_by TEXT,                        -- owner email
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by TEXT
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,              -- uuid
  group_id TEXT NOT NULL REFERENCES groups(id),
  name TEXT NOT NULL,               -- stored lowercase for lookup, unique WITHIN a group
  display_name TEXT NOT NULL,       -- original casing, for display
  phone TEXT,                       -- normalized digits (+ leading "+" if given); nullable
                                     -- since older accounts predate this — required for
                                     -- every new signup though (see joinGroup() in auth.js).
                                     -- An alternate login identifier (name OR phone), and the
                                     -- groundwork for a future PIN-reset via SMS/WhatsApp.
                                     -- Unique WITHIN a group, like name — see the index below.
  pin_salt TEXT NOT NULL,
  pin_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',   -- 'member' | 'admin' — see adminUtils.js: an
                                          -- existing admin can promote another member of
                                          -- their OWN group via the app; the only ways to
                                          -- become the FIRST admin of a group are creating
                                          -- it or a direct database write
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT,                -- login rejected while now() < locked_until
  active INTEGER NOT NULL DEFAULT 1, -- 0 once an admin removes them — soft
                                      -- delete, their payment history stays intact
  removed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(group_id, name)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_group_phone ON users(group_id, phone);
CREATE INDEX IF NOT EXISTS idx_users_group ON users(group_id);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);

-- Each row is one member's contribution into one community fund, for one
-- schedule date. Recorded automatically the moment a member's payments for
-- that date first reach their due amount (not on every log entry — a
-- member paying in two installments should still only fund once per date).
-- Readable by all members of the SAME group — not admins-only, and never
-- across groups. Only ever holds {name, fund, amount, date} — never a
-- member's balance, rate, or full payment history.
-- payment_id links a row to the specific confirmed payment it was split
-- from (see migration 007) — NULL for the older threshold-crediting rows
-- below, which aren't tied to one payment. UNIQUE folds payment_id in so
-- a member with more than one payment against the same date can have
-- each independently-confirmed payment credit its own row; SQLite never
-- treats two NULLs as equal under UNIQUE, so the old system's original
-- one-credit-per-member-per-date-per-fund guarantee is unaffected.
CREATE TABLE IF NOT EXISTS fund_contributions (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES groups(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  display_name TEXT NOT NULL,
  schedule_row_id TEXT NOT NULL,
  fund_id TEXT NOT NULL,
  amount REAL NOT NULL,
  recorded_at TEXT NOT NULL DEFAULT (datetime('now')),
  payment_id TEXT REFERENCES payments(id),
  UNIQUE(user_id, schedule_row_id, fund_id, payment_id)
);
CREATE INDEX IF NOT EXISTS idx_fund_contrib_group ON fund_contributions(group_id, recorded_at);

-- Append-only payment log. Never UPDATE amount/recorded_at on an existing
-- row — corrections are made by setting voided_at and inserting a new row.
CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,               -- uuid
  group_id TEXT NOT NULL REFERENCES groups(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  schedule_row_id TEXT NOT NULL,
  amount REAL NOT NULL,
  note TEXT DEFAULT '',
  recorded_by TEXT NOT NULL,         -- display name at time of entry
  recorded_at TEXT NOT NULL DEFAULT (datetime('now')),
  voided_at TEXT,
  void_reason TEXT,
  confirmed_at TEXT,                 -- set once an admin has actually seen
                                      -- the money arrive (statement, deposit
                                      -- slip, etc.) — a trust flag, not a
                                      -- gate; unconfirmed still counts fully
  confirmed_by TEXT,
  community_fund_amount REAL NOT NULL DEFAULT 0, -- portion diverted to the
                                      -- community fund, set ONLY at confirm
                                      -- time (see migration 007) — 0 until
                                      -- then, reset to 0 again if unconfirmed
  status TEXT,                       -- NULL for every payment logged before
                                      -- migration 009 (still counts fully,
                                      -- unconfirmed, per migration 004) —
                                      -- 'pending' for a member-submitted
                                      -- entry awaiting admin review, which
                                      -- counts ZERO until confirmed or
                                      -- rejected (see migration 009)
  rejected_at TEXT,
  rejected_by TEXT,
  rejection_reason TEXT
);
CREATE INDEX IF NOT EXISTS idx_payments_user ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_group ON payments(group_id);

CREATE TABLE IF NOT EXISTS payouts (
  user_id TEXT PRIMARY KEY REFERENCES users(id),
  group_id TEXT NOT NULL REFERENCES groups(id),
  amount REAL NOT NULL DEFAULT 0,
  received_date TEXT,
  recorded_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Per-member overrides of the shared schedule's default "due" amount.
-- Members are not all charged the same rate — payout totals differ too
-- (e.g. one member's payout is K25,700, another's is K17,500) — so each
-- member's own agreed amount for a date can diverge from the group default
-- without changing what anyone else owes.
CREATE TABLE IF NOT EXISTS due_overrides (
  user_id TEXT NOT NULL REFERENCES users(id),
  group_id TEXT NOT NULL REFERENCES groups(id),
  schedule_row_id TEXT NOT NULL,
  amount REAL NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, schedule_row_id)
);

-- Superseded by group_subscriptions below (per-GROUP now, not per-user —
-- see migrations/002 for the full explanation). Left in place, unused,
-- rather than dropped, in case any already-deployed database has real
-- rows in it.
CREATE TABLE IF NOT EXISTS subscriptions (
  user_id TEXT PRIMARY KEY REFERENCES users(id),
  group_id TEXT NOT NULL REFERENCES groups(id),
  masked_phone TEXT NOT NULL,
  network TEXT NOT NULL,
  amount REAL NOT NULL,
  reference TEXT NOT NULL,
  paid_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

-- The group's subscription IS its access to premium features — K100
-- every 6 months, submitted once by an admin, benefits every member of
-- the group. Regular members never see a payment form. A submission
-- lands here as 'pending' and does NOT touch groups.subscription_expires_at
-- by itself (see routes/subscription.js) — only a platform owner
-- confirming it (routes/owner.js, after checking the money actually
-- arrived, same trust model as migration 004's payment confirmation)
-- sets expires_at here and on the group. This is what actually closes
-- the "always succeeds" gap the pre-migration-008 charge endpoint had.
CREATE TABLE IF NOT EXISTS group_subscriptions (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES groups(id),
  paid_by TEXT NOT NULL,          -- display name of the admin who submitted the claim
  masked_phone TEXT NOT NULL,
  network TEXT NOT NULL,
  amount REAL NOT NULL,
  reference TEXT NOT NULL,
  paid_at TEXT NOT NULL,          -- when the claim was submitted
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'confirmed' | 'rejected'
  expires_at TEXT,                -- set only once confirmed, from confirm time
  confirmed_at TEXT,
  confirmed_by TEXT,              -- owner email
  notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_group_subscriptions_group ON group_subscriptions(group_id);
CREATE INDEX IF NOT EXISTS idx_group_subscriptions_status ON group_subscriptions(status);

-- Platform owner — entirely separate from any group's admin. Its own
-- table with its own primary-key/token space (see owner_sessions below)
-- so a compromised group-admin session can never be looked up here; no
-- HTTP path creates a row in this table (see scripts/create-owner.sh,
-- which writes the first — and any subsequent — owner directly via
-- `wrangler d1 execute`, requiring actual Cloudflare account access).
CREATE TABLE IF NOT EXISTS owners (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,    -- PBKDF2-SHA256, same crypto.js as PINs, applied
                                   -- to a real password instead of a 4-digit PIN
  password_salt TEXT NOT NULL,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS owner_sessions (
  token TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES owners(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);

-- Admin-to-members announcements, scoped to one group.
CREATE TABLE IF NOT EXISTS notices (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES groups(id),
  message TEXT NOT NULL,
  posted_by TEXT NOT NULL,
  posted_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_notices_group ON notices(group_id);

-- Platform-owner direct messaging (migration 010) — deliberately separate
-- from notices above: this is the OWNER's one-way channel (to a specific
-- person, a group's admins, or a group's members), not a group admin's
-- own announcement. The only route that ever inserts here is
-- POST /api/owner/messages, gated by requireOwner — never requireAdmin
-- or requireSession — so a group admin has no way to create or spoof one.
CREATE TABLE IF NOT EXISTS owner_messages (
  id TEXT PRIMARY KEY,
  target_type TEXT NOT NULL,        -- 'user' | 'group_admins' | 'group_members'
  group_id TEXT NOT NULL REFERENCES groups(id),
  user_id TEXT REFERENCES users(id),  -- set only when target_type = 'user'
  target_label TEXT NOT NULL,       -- snapshot for the owner's log, e.g.
                                     -- "Harriet Banda (Hillcrest Chilimba)"
  message TEXT NOT NULL,
  whatsapp_requested INTEGER NOT NULL DEFAULT 0,
  category TEXT,                    -- optional template category (migration 011) —
                                     -- fraud_warning | spam_abuse | subscription_reminder |
                                     -- account_suspended | general_announcement |
                                     -- payment_dispute, or NULL for freeform; a label for
                                     -- the owner's own log only (src/lib/messageTemplates.js),
                                     -- never affects delivery or targeting
  sent_by TEXT NOT NULL,            -- owner email
  sent_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_owner_messages_sent ON owner_messages(sent_at);

-- Fan-out: one row per actually-resolved recipient. A member's own
-- GET /api/messages / POST /api/messages/:id/read (requireSession) are
-- always scoped by `user_id = <caller's own id>` — the only way to read
-- or dismiss a row here is to be the person it was addressed to.
CREATE TABLE IF NOT EXISTS owner_message_recipients (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL REFERENCES owner_messages(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  read_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_owner_message_recipients_user ON owner_message_recipients(user_id, read_at);

-- Web push subscriptions — a member can have more than one (phone + laptop).
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES groups(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_push_user ON push_subscriptions(user_id);

-- Reminder preferences. phone here is the FULL number, unlike the masked
-- mobile-money phone in `subscriptions` — SMS delivery needs the real
-- number. Stored separately from payment data so a data export or leak of
-- one doesn't automatically expose the other.
CREATE TABLE IF NOT EXISTS reminder_prefs (
  user_id TEXT PRIMARY KEY REFERENCES users(id),
  group_id TEXT NOT NULL REFERENCES groups(id),
  push_enabled INTEGER NOT NULL DEFAULT 0,
  sms_enabled INTEGER NOT NULL DEFAULT 0,
  phone TEXT,
  lead_days INTEGER NOT NULL DEFAULT 2,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_reminder_prefs_group ON reminder_prefs(group_id);

-- Per-date overrides on top of the blanket reminder_prefs above — a
-- custom lead time for one date, or muted entirely. No row means "use
-- my default"; only customized dates get a row here.
CREATE TABLE IF NOT EXISTS reminder_date_overrides (
  user_id TEXT NOT NULL REFERENCES users(id),
  group_id TEXT NOT NULL REFERENCES groups(id),
  schedule_row_id TEXT NOT NULL,
  lead_days INTEGER,
  muted INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, schedule_row_id)
);
CREATE INDEX IF NOT EXISTS idx_reminder_date_overrides_group ON reminder_date_overrides(group_id);

-- Prevents sending the same reminder twice if the cron runs more than once
-- inside the lead window.
CREATE TABLE IF NOT EXISTS reminder_log (
  user_id TEXT NOT NULL REFERENCES users(id),
  schedule_row_id TEXT NOT NULL,
  channel TEXT NOT NULL,             -- 'push' | 'sms'
  sent_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, schedule_row_id, channel)
);

-- Loans against a loanable fund (e.g. Future Sharing Fund). Only funds
-- with "loanable": true in a group's funds_json are eligible — the Worker
-- checks this before issuing. Issuing and repaying are admin-only actions
-- (real money leaving/returning the pool), but every loan is readable by
-- all members of that group via /api/funds — same transparency principle
-- as fund_contributions.
CREATE TABLE IF NOT EXISTS fund_loans (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES groups(id),
  fund_id TEXT NOT NULL,
  borrower_user_id TEXT REFERENCES users(id),   -- nullable: borrower may not be an app user yet
  borrower_name TEXT NOT NULL,
  amount REAL NOT NULL,
  notes TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'outstanding',   -- 'outstanding' | 'repaid'
  issued_by TEXT NOT NULL,                      -- admin display name
  issued_at TEXT NOT NULL DEFAULT (datetime('now')),
  repaid_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_loans_group ON fund_loans(group_id, fund_id);

-- Seed one example group so the app is usable immediately after a fresh
-- deploy. Real groups are created via POST /api/groups (see routes/groups.js)
-- — a new group and its first admin are created together in one step, since
-- there's no platform superadmin to bootstrap an empty group otherwise.
INSERT OR IGNORE INTO groups (id, slug, group_name, cycle_name, recipient_exempt, schedule_json, funds_json)
VALUES ('seed-hillcrest', 'hillcrest', 'Hillcrest Chilimba', 'Cycle 3', 1, '[]',
  '[{"id":"future","name":"Future Sharing Fund","amount":100,"loanable":true},{"id":"hospital","name":"Hospital Emergency Fund","amount":20,"loanable":false}]');

-- Making someone an admin no longer requires touching the database — any
-- existing admin can promote a member of their own group from inside the
-- app (Group Setup → Admins, or POST /api/admin/promote). This direct
-- write is still here as an emergency fallback (e.g. a group's last
-- admin is unreachable and nobody else can promote):
-- UPDATE users SET role = 'admin' WHERE group_id = (SELECT id FROM groups WHERE slug = 'hillcrest') AND name = 'harriet';
