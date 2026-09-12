-- Migration 021: gender, for greeting phrasing only.
--
-- Optional — collected at sign-up as a plain male/female choice, stored
-- once, and read in exactly one place: dashboardMath.js's greeting()
-- picks how the app addresses the signed-in member. Nothing else in the
-- app (payments, schedule, roles, reminders...) ever looks at this
-- column. NULL (declined, or an account that predates this migration)
-- just falls back to the same name-only greeting the app always used.
--
-- Apply with:
--   scripts/apply-migration.sh worker/schema/migrations/021_gender.sql

ALTER TABLE users ADD COLUMN gender TEXT;
