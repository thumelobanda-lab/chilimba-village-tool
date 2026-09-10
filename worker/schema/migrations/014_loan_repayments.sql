-- Migration 014: partial loan repayments.
--
-- fund_loans.status was previously a single manual flip — one action
-- (POST /api/admin/loans/:id/repay) moved a loan straight from
-- 'outstanding' to fully 'repaid', with no way to record a partial
-- payment or watch a running balance go down. This table makes
-- repayment an append-only ledger against a loan, the same audit
-- standard as payments/fund_contributions elsewhere in this schema: a
-- loan's remaining balance is always `fund_loans.amount minus the sum
-- of its loan_repayments`, computed fresh, never stored/mutated
-- directly. fund_loans.status still exists and still flips to 'repaid'
-- (see worker/src/routes/admin.js's repay route) once the running
-- balance reaches zero, purely so existing status-based queries keep
-- working without a rewrite — the repayments table is the source of
-- truth, status is a derived convenience.
--
-- Apply with:
--   scripts/apply-migration.sh worker/schema/migrations/014_loan_repayments.sql

CREATE TABLE IF NOT EXISTS loan_repayments (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES groups(id),
  loan_id TEXT NOT NULL REFERENCES fund_loans(id),
  amount REAL NOT NULL,
  recorded_by TEXT NOT NULL,
  recorded_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_loan_repayments_loan ON loan_repayments(loan_id);
CREATE INDEX IF NOT EXISTS idx_loan_repayments_group ON loan_repayments(group_id);
