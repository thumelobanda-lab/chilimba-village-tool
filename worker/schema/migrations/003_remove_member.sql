-- Migration 003: admin can remove a member.
--
-- Deliberately a SOFT removal, not a hard delete. A removed member's
-- historical payments are real financial events that already happened —
-- deleting them would corrupt reconciliation and the community fund
-- feed for everyone else, and would be exactly the wrong instinct for a
-- tool whose whole point is a trustworthy record. "Remove" means: they
-- can no longer log in, and they drop off the active roster. Their past
-- contributions stay exactly as they were.
--
-- Apply with:
--   npx wrangler d1 execute chilimba-db --remote --file=./schema/migrations/003_remove_member.sql

ALTER TABLE users ADD COLUMN active INTEGER NOT NULL DEFAULT 1;
ALTER TABLE users ADD COLUMN removed_at TEXT;
