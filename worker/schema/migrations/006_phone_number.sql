-- Migration 006: phone number as an alternate identifier.
--
-- Sign-up now collects a required phone number alongside full name —
-- it becomes an alternate way to sign in (name OR phone, see login() in
-- worker/src/auth.js) and lays the groundwork for a future PIN-reset
-- via SMS/WhatsApp (PINs are one-way hashed and otherwise unrecoverable
-- — see resetMemberPin in routes/admin.js for the current admin-driven
-- reset path this would eventually supplement).
--
-- Nullable, not NOT NULL: existing accounts predate this column and
-- have no phone on file. SQLite's UNIQUE index already treats every
-- NULL as distinct from every other NULL (standard SQL behavior, same
-- as Postgres), so old rows with no phone never collide with each other
-- or block a real number from being claimed later — only two non-NULL
-- phone numbers within the same group can conflict, exactly as intended.
-- Scoped per group (group_id, phone), not globally, matching how name
-- uniqueness already works — the same person can be a genuinely
-- separate member of a different group.
--
-- Apply with:
--   npx wrangler d1 execute chilimba-db --remote --file=./schema/migrations/006_phone_number.sql

ALTER TABLE users ADD COLUMN phone TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_group_phone ON users(group_id, phone);
