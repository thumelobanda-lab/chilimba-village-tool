-- Migration 007: automatic community fund splitting on payment confirmation.
--
-- Adds a group-level fixed deduction (community_fund_deduction, K amount,
-- admin-editable via the schedule config) that's split off a member's
-- payment once — and only once — an admin confirms it: the deduction goes
-- to an implicit "Community Fund" balance, the remainder is what counts
-- toward the member's due/paid/balance from then on. Deliberately gated
-- on confirmation, not on logging: an unconfirmed payment keeps counting
-- its full amount, matching the existing trust-flag rule from migration
-- 004 ("unconfirmed still counts fully everywhere").
--
-- payments.community_fund_amount is populated ONLY at confirm time (see
-- worker/src/routes/admin.js), frozen using whatever deduction rate was
-- configured at that moment — capped at the payment's own amount so a
-- small payment can never produce a negative remainder. It stays 0 for
-- an unconfirmed payment and is reset to 0 again if later unconfirmed
-- (see the unconfirm route), keeping "confirmed with amount > 0" and
-- "credited to the fund" a matching pair.
--
-- fund_contributions gets the same treatment as the schema comment above
-- already documents for its existing UNIQUE(user_id, schedule_row_id,
-- fund_id): that constraint assumed at most one credit per member per
-- date per fund, true for the threshold-crediting system it was built
-- for (worker/src/fundCrediting.js, fires once per crossing). It is NOT
-- true for this new payment-linked credit — a member can log more than
-- one payment against the same date, and each independently-confirmed
-- payment needs its own community-fund credit row. SQLite can't alter a
-- UNIQUE constraint in place, so the table is rebuilt with payment_id
-- added and folded into the uniqueness. Existing (threshold-system) rows
-- get payment_id = NULL, and SQLite never treats two NULLs as equal
-- under UNIQUE, so their original one-credit-per-date guarantee is
-- unaffected; new payment-linked rows get their own slot per payment.
-- payment_id is also how the unconfirm route finds exactly the right
-- fund_contributions row to remove, rather than guessing by date.
--
-- Apply with:
--   npx wrangler d1 execute chilimba-db --remote --file=./schema/migrations/007_community_fund_split.sql

ALTER TABLE groups ADD COLUMN community_fund_deduction REAL NOT NULL DEFAULT 0;
ALTER TABLE payments ADD COLUMN community_fund_amount REAL NOT NULL DEFAULT 0;

CREATE TABLE fund_contributions_new (
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
INSERT INTO fund_contributions_new (id, group_id, user_id, display_name, schedule_row_id, fund_id, amount, recorded_at, payment_id)
  SELECT id, group_id, user_id, display_name, schedule_row_id, fund_id, amount, recorded_at, NULL FROM fund_contributions;
DROP TABLE fund_contributions;
ALTER TABLE fund_contributions_new RENAME TO fund_contributions;
CREATE INDEX IF NOT EXISTS idx_fund_contrib_group ON fund_contributions(group_id, recorded_at);
