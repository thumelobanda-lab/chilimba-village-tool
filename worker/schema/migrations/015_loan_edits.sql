-- Migration 015: loan corrections + repayment voiding.
--
-- Closes the one gap the loan feature launched with: a typo'd amount or
-- borrower name at issuance, or a mis-keyed repayment, had no way to be
-- fixed short of leaving it wrong forever. fund_loans itself is a single
-- "who owes what, from when" record (not a summed ledger the way
-- payments/loan_repayments are), so correcting it is a direct UPDATE —
-- but every correction is captured in loan_edits first, same "who
-- and when" standard as everywhere else in this schema. loan_repayments
-- stays append-only (see migration 014's comment) — a wrong repayment
-- entry is voided, never overwritten, exactly like payments.voided_at.
--
-- Apply with:
--   scripts/apply-migration.sh worker/schema/migrations/015_loan_edits.sql

ALTER TABLE loan_repayments ADD COLUMN voided_at TEXT;
ALTER TABLE loan_repayments ADD COLUMN void_reason TEXT;

CREATE TABLE IF NOT EXISTS loan_edits (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES groups(id),
  loan_id TEXT NOT NULL REFERENCES fund_loans(id),
  previous_amount REAL NOT NULL,
  previous_borrower_name TEXT NOT NULL,
  edited_by TEXT NOT NULL,
  edited_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_loan_edits_loan ON loan_edits(loan_id);
CREATE INDEX IF NOT EXISTS idx_loan_edits_group ON loan_edits(group_id);
