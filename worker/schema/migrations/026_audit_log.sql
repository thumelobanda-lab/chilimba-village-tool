-- Migration 026: audit_log, backing worker/src/auditLog.js.
--
-- One row per admin-initiated mutation that affects someone else's
-- account or money — promote/demote/remove, PIN resets, payment
-- confirm/unconfirm/reject, and every loan action. Several of these
-- actions already stamp a `*_by`/`*_at` pair onto their own row
-- (payments.confirmed_by, loan_edits, loan_repayments.recorded_by), but
-- those are scattered one table per action type with no shared
-- timeline — this table is a single, group-scoped feed an admin can
-- read chronologically (GET /api/admin/audit-log) without knowing in
-- advance which table a given action landed in.
--
-- Apply with:
--   scripts/apply-migration.sh worker/schema/migrations/026_audit_log.sql

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES groups(id),
  actor_name TEXT NOT NULL,
  action TEXT NOT NULL,
  target_name TEXT,
  detail TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_audit_log_group_created ON audit_log(group_id, created_at);
