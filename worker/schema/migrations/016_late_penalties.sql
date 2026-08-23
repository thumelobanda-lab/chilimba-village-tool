-- Migration 016: admin-configurable late payment penalty.
--
-- A fixed K amount, set per group (groups.late_penalty_amount, same
-- premium-gated pattern as community_fund_deduction — see
-- worker/src/routes/schedule.js), applied automatically the moment an
-- admin confirms a payment that was logged after its schedule row's due
-- date. The penalty is frozen onto the payment itself
-- (payments.late_penalty_amount) at confirm time, exactly like
-- community_fund_amount, so it survives a later change to the group's
-- configured rate and reverses cleanly if the confirmation is undone.
--
-- Kept as its own table (late_penalties) rather than another
-- fund_contributions row: fund_contributions has
-- UNIQUE(user_id, schedule_row_id, fund_id, payment_id), which the
-- existing community-fund-split credit for this same payment/date/fund
-- already occupies — a second row for the same four values would
-- collide. A dedicated append-only table sidesteps that entirely and
-- gives the penalty its own clean, self-labeled audit trail (every
-- late_penalties row IS a penalty, no need to infer it from context),
-- which is also what lets Community.jsx show it as its own line item
-- ("K20 late penalty — added to Group Savings Fund") distinct from the
-- regular contribution split. GET /api/funds sums this table into the
-- community fund's balance alongside fund_contributions.
--
-- Apply with:
--   npx wrangler d1 execute chilimba-db --remote --file=./schema/migrations/016_late_penalties.sql

ALTER TABLE groups ADD COLUMN late_penalty_amount REAL NOT NULL DEFAULT 0;
ALTER TABLE payments ADD COLUMN late_penalty_amount REAL NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS late_penalties (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES groups(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  display_name TEXT NOT NULL,
  schedule_row_id TEXT NOT NULL,
  payment_id TEXT NOT NULL REFERENCES payments(id),
  amount REAL NOT NULL,
  recorded_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(payment_id)
);
CREATE INDEX IF NOT EXISTS idx_late_penalties_group ON late_penalties(group_id, recorded_at);
