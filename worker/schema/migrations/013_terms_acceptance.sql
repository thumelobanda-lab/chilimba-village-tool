-- Migration 013: record Terms & Conditions acceptance at sign-up.
--
-- Both self-service account-creation paths — POST /api/join (a new
-- member joining an existing group) and POST /api/groups (a new admin
-- creating a group) — now require termsAccepted: true in the request
-- body and reject with 400 otherwise (see worker/src/auth.js). This
-- column is the server-side record that acceptance actually happened,
-- not just a client-side checkbox that could be bypassed by calling the
-- API directly.
--
-- Deliberately NOT retroactive: every account created before this
-- column existed keeps terms_accepted_at = NULL — there is no
-- requirement here to force existing members to re-accept, matching how
-- every other additive column in this schema (e.g. payments.status,
-- migration 009) treats pre-existing rows.
--
-- Apply with:
--   npx wrangler d1 execute chilimba-db --remote --file=./schema/migrations/013_terms_acceptance.sql

ALTER TABLE users ADD COLUMN terms_accepted_at TEXT;
