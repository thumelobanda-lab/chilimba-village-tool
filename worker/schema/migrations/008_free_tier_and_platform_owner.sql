-- Migration 008: real subscription verification + free tier + platform owner.
--
-- Part A — closes a leak where POST /api/subscription/charge was a
-- placeholder that always succeeded (no real mobile money gateway is
-- wired up yet), meaning any admin could instantly "activate" 6 months
-- of access for free. Two of the three real groups on this database did
-- exactly that. Fix: charging now creates a PENDING request; nothing in
-- groups.subscription_expires_at changes until a platform owner (see
-- Part B) confirms real money actually arrived, mirroring the existing
-- member-payment confirm pattern (migration 004) rather than trusting a
-- client-side "I paid" click. Every group without a CONFIRMED,
-- unexpired subscription is now free tier — a real, usable state with
-- limits (member cap, no receipts, no automated reminders, no
-- community-fund splitting — enforced in application code, not here)
-- rather than the previous all-or-nothing block.
--
-- The two groups that "activated" via the old placeholder never had a
-- real payment verified, so their access is revoked back to free tier
-- here (see CLAUDE.md session record — confirmed explicitly before
-- applying). Their group_subscriptions rows are kept for audit rather
-- than deleted, marked 'rejected' with a note explaining why.
--
-- Part B — a platform owner role, entirely separate from group admins:
-- its own table (owners), its own sessions table (owner_sessions) so a
-- compromised group-admin session token can never be looked up there —
-- there is no shared table or shared token space to escalate through.
-- No self-service or HTTP bootstrap path is created for it on purpose;
-- see scripts/create-owner.sh, which writes the first owner row directly
-- via `wrangler d1 execute`, requiring actual Cloudflare account access
-- rather than a leakable static secret.
--
-- Apply with:
--   npx wrangler d1 execute chilimba-db --remote --file=./schema/migrations/008_free_tier_and_platform_owner.sql

ALTER TABLE groups ADD COLUMN created_ip TEXT;          -- cf-connecting-ip at creation time
ALTER TABLE groups ADD COLUMN created_by_phone TEXT;    -- optional, if the creating admin gave one
ALTER TABLE groups ADD COLUMN suspended_at TEXT;
ALTER TABLE groups ADD COLUMN suspended_reason TEXT;
ALTER TABLE groups ADD COLUMN suspended_by TEXT;        -- owner email

-- Revoke: neither of the currently-"active" groups ever had a real
-- payment confirmed (see the migration comment above) — every group is
-- free tier again until a real one goes through the new pending/confirm
-- flow below.
UPDATE groups SET subscription_expires_at = NULL;

-- Rebuild group_subscriptions with a pending -> confirmed/rejected
-- workflow (SQLite can't relax expires_at's NOT NULL or add these
-- columns' semantics via plain ALTER, so the table is rebuilt, same
-- technique as migration 007's fund_contributions rebuild). Existing
-- rows are kept, not deleted, but marked rejected with an explanatory
-- note — they represent the old always-succeeds bug, not a real payment.
CREATE TABLE group_subscriptions_new (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES groups(id),
  paid_by TEXT NOT NULL,          -- display name of the admin who submitted the claim
  masked_phone TEXT NOT NULL,
  network TEXT NOT NULL,
  amount REAL NOT NULL,
  reference TEXT NOT NULL,
  paid_at TEXT NOT NULL,          -- when the claim was submitted
  status TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'confirmed' | 'rejected'
  expires_at TEXT,                -- set only once confirmed, computed from confirm time
  confirmed_at TEXT,
  confirmed_by TEXT,              -- owner email
  notes TEXT
);
INSERT INTO group_subscriptions_new
  (id, group_id, paid_by, masked_phone, network, amount, reference, paid_at, status, expires_at, confirmed_at, confirmed_by, notes)
  SELECT id, group_id, paid_by, masked_phone, network, amount, reference, paid_at, 'rejected', NULL, NULL, NULL,
    'Auto-migrated: submitted before real payment verification existed (the charge endpoint always succeeded) — no real payment was ever confirmed for this submission.'
  FROM group_subscriptions;
DROP TABLE group_subscriptions;
ALTER TABLE group_subscriptions_new RENAME TO group_subscriptions;
CREATE INDEX IF NOT EXISTS idx_group_subscriptions_group ON group_subscriptions(group_id);
CREATE INDEX IF NOT EXISTS idx_group_subscriptions_status ON group_subscriptions(status);

CREATE TABLE IF NOT EXISTS owners (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Deliberately its own table, not a row in `sessions` with some kind of
-- owner flag — a user session token and an owner session token live in
-- structurally separate tables with separate primary-key spaces, so
-- requireOwner() (worker/src/ownerAuth.js) can NEVER match a token
-- lifted from a compromised group-admin account, by construction, not
-- just by a runtime role check.
CREATE TABLE IF NOT EXISTS owner_sessions (
  token TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES owners(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);
