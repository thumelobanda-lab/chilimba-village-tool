-- Migration 005: per-date reminder overrides.
--
-- Reminders are currently all-or-nothing: one lead-time setting applies
-- identically to every payout date. This lets a member override that
-- for a specific date — a custom lead time (e.g. 5 days before their
-- own payout date instead of 2), or muted entirely (don't remind me
-- about this one at all). Absence of a row for a (user, date) pair
-- means "use my default" — nothing needs to be created for every date,
-- only the ones someone actually wants to customize.
--
-- The decision logic (selectReminderCandidates in reminderSelection.js)
-- already supported this shape before this migration existed — it just
-- had nothing to read from. This migration and the routes/sweep changes
-- that come with it are what actually wire it up.
--
-- Apply with:
--   npx wrangler d1 execute chilimba-db --remote --file=./schema/migrations/005_reminder_date_overrides.sql

CREATE TABLE IF NOT EXISTS reminder_date_overrides (
  user_id TEXT NOT NULL REFERENCES users(id),
  group_id TEXT NOT NULL REFERENCES groups(id),
  schedule_row_id TEXT NOT NULL,
  lead_days INTEGER,              -- NULL means "use my default lead time"
  muted INTEGER NOT NULL DEFAULT 0, -- 1 = never remind me about this date
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, schedule_row_id)
);
CREATE INDEX IF NOT EXISTS idx_reminder_date_overrides_group ON reminder_date_overrides(group_id);
