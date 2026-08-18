-- Migration 002: group-level subscription, payment destination info, notices.
--
-- Purely additive — safe to run against a database that already has real
-- data (existing groups, users, payments). Nothing here drops or rewrites
-- an existing column or table.
--
-- Apply with:
--   npx wrangler d1 execute chilimba-db --remote --file=./schema/migrations/002_group_subscription_payment_notices.sql
--
-- What changed and why:
--
-- 1. Subscription moved from per-USER to per-GROUP. The old `subscriptions`
--    table (one row per user, K25/cycle, anyone could pay) is left in place
--    untouched — it's simply no longer read by the app. The new model: a
--    group's admin pays K100 once, it activates the WHOLE group for 6
--    months, and every member benefits without paying individually.
--    `subscription_expires_at` on `groups` is the fast check the app makes
--    on every login; `group_subscriptions` keeps the paid history (who
--    paid, when, how) the same way `fund_loans` keeps loan history rather
--    than just overwriting a single balance.
--
-- 2. `payment_info_json` on `groups` holds where members should actually
--    send their biweekly contribution — mobile money numbers, bank
--    details — admin-edited, member-visible. Same JSON-blob pattern as
--    schedule_json and funds_json already on this table.
--
-- 3. `notices` is a simple admin-to-members announcement board, scoped to
--    one group like everything else.

ALTER TABLE groups ADD COLUMN subscription_expires_at TEXT;
ALTER TABLE groups ADD COLUMN payment_info_json TEXT NOT NULL DEFAULT '[]';

CREATE TABLE IF NOT EXISTS group_subscriptions (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES groups(id),
  paid_by TEXT NOT NULL,          -- display name of the admin who paid
  masked_phone TEXT NOT NULL,
  network TEXT NOT NULL,
  amount REAL NOT NULL,
  reference TEXT NOT NULL,
  paid_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_group_subscriptions_group ON group_subscriptions(group_id);

CREATE TABLE IF NOT EXISTS notices (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES groups(id),
  message TEXT NOT NULL,
  posted_by TEXT NOT NULL,        -- display name of the admin who posted it
  posted_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_notices_group ON notices(group_id);
