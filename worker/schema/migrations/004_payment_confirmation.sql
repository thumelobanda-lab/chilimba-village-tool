-- Migration 004: admin can confirm a member's payment.
--
-- Right now a payment is fully trusted the moment a member logs it —
-- there's no verification step at all. This adds a lightweight one: an
-- admin can mark a specific payment entry as confirmed once they've
-- actually seen the money arrive (checked the mobile money statement,
-- bank deposit, etc.). It's a flag on the existing entry, not a new
-- workflow that blocks anything — an unconfirmed payment still counts
-- fully toward due/paid/balance everywhere. Confirmation is about
-- visible trust, not about gating.
--
-- Apply with:
--   npx wrangler d1 execute chilimba-db --remote --file=./schema/migrations/004_payment_confirmation.sql

ALTER TABLE payments ADD COLUMN confirmed_at TEXT;
ALTER TABLE payments ADD COLUMN confirmed_by TEXT;
