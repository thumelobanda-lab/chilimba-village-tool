-- Migration 025: rate_limits, backing worker/src/rateLimit.js.
--
-- One row per (scope, hashed-identity) key — e.g. a login attempt's
-- account or IP, a group-code guess, an owner-login attempt. Keys are
-- SHA-256 hashes of the underlying identity (never a raw IP, name, or
-- email — see rateKey() in rateLimit.js), so this table holds no
-- personal data even though it tracks failed-attempt history.
--
-- `blocked_until` is 0 (not blocked) most of the time; it's only set to
-- a future timestamp after enough failures under a policy's backoff
-- curve. Rows are cheap to accumulate (one per distinct key that has
-- ever failed) and get swept by purgeStaleRateLimits() off the daily
-- cron once both failures and any block are well in the past.
--
-- Apply with:
--   scripts/apply-migration.sh worker/schema/migrations/025_rate_limits.sql

CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  failures INTEGER NOT NULL DEFAULT 0,
  last_failure_at INTEGER NOT NULL,
  blocked_until INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_rate_limits_last_failure ON rate_limits(last_failure_at);
