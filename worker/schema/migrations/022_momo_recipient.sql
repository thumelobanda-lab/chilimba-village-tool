-- Migration 022: per-member mobile money payout recipient.
--
-- Where a member's payout should actually be sent — separate from
-- `phone` (their login identifier) since the two can legitimately
-- differ (e.g. a shared household phone for login, a personal wallet
-- for payouts). Nullable: unset until a member fills it in themselves
-- (self-service, any time — see src/components/Profile.jsx), and
-- nothing here triggers an actual disbursement — this is the data
-- field and UI only, per docs/momo-integration-scope.md's explicit
-- deferral of disbursement to its own separate scoping.
--
-- Apply with:
--   scripts/apply-migration.sh worker/schema/migrations/022_momo_recipient.sql

ALTER TABLE users ADD COLUMN momo_provider TEXT;
ALTER TABLE users ADD COLUMN momo_phone TEXT;
