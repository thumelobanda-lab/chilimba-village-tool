-- Migration 009: member-submitted payments require admin confirm/reject
-- before they count.
--
-- Migration 004 made an unconfirmed payment count fully toward due/paid/
-- balance — confirmation was a trust flag, not a gate. This adds a
-- narrower, explicit "pending" state on top of that: a payment logged
-- through the ordinary self-report flow (POST /api/contributions/payments,
-- the only way a payment is ever created) is now inserted with
-- status = 'pending' and counts ZERO — not its full amount — until an
-- admin acts on it. Confirming it (existing /api/admin/payments/:id/confirm
-- route, unchanged) makes it count exactly like any other confirmed
-- payment always has (full amount minus whatever the community-fund split
-- takes). Rejecting it (new /api/admin/payments/:id/reject route) keeps it
-- permanently at zero, visible with a reason, same append-only spirit as
-- voiding.
--
-- Deliberately NOT retroactive: every payment already in the table keeps
-- status = NULL, and effectiveContribution() (src/lib/ledgerMath.js,
-- worker/src/communityFundSplit.js) still counts a NULL-status unconfirmed
-- payment fully, exactly as migration 004 intended — a member who's
-- already logged and been trusted for a payment doesn't suddenly see
-- their balance drop because this column now exists.
--
-- Apply with:
--   npx wrangler d1 execute chilimba-db --remote --file=./schema/migrations/009_pending_member_payments.sql

ALTER TABLE payments ADD COLUMN status TEXT;
ALTER TABLE payments ADD COLUMN rejected_at TEXT;
ALTER TABLE payments ADD COLUMN rejected_by TEXT;
ALTER TABLE payments ADD COLUMN rejection_reason TEXT;
