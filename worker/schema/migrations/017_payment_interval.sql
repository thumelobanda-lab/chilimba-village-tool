-- Migration 017: persist the payout schedule's cadence.
--
-- groups.payment_interval stores which SCHEDULE_FREQUENCIES key
-- (weekly/biweekly/monthly/bimonthly — see src/lib/scheduleUtils.js)
-- the admin last used with GroupSetup's "Generate Payout Dates" tool,
-- so it survives logout instead of silently resetting to "biweekly"
-- every time that screen is reopened. Also what the anticipated
-- cycle-end projection (member count x interval) is computed from
-- wherever the cycle is referenced (dashboard, Group Setup, roster).
--
-- Apply with:
--   npx wrangler d1 execute chilimba-db --remote --file=./schema/migrations/017_payment_interval.sql

ALTER TABLE groups ADD COLUMN payment_interval TEXT NOT NULL DEFAULT 'biweekly';
