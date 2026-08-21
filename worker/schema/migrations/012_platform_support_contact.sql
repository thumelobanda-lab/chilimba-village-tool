-- Migration 012: platform-wide support contact, for the [Contact]
-- placeholder in owner-messaging templates (src/lib/messageTemplates.js).
--
-- A singleton, not a per-owner column: the support contact shown to a
-- suspended/flagged group is "how to reach Chilimba Circle", not "how to
-- reach whichever owner happened to be signed in when the message was
-- composed" — one value, shared by every owner account, set once and
-- reused across every template send from then on. Modeled as a
-- single-row table (id always 'default', enforced in application code
-- via an upsert, not a DB constraint) rather than a key/value settings
-- table, since there is exactly one thing to configure right now and a
-- generic settings table would be speculative machinery for a feature
-- that doesn't exist yet.
--
-- Read/write is requireOwner-gated (GET/PUT /api/owner/settings, see
-- routes/owner.js) — same isolation as every other owner route; a group
-- admin has no path to read or change this.
--
-- Apply with:
--   npx wrangler d1 execute chilimba-db --remote --file=./schema/migrations/012_platform_support_contact.sql

CREATE TABLE IF NOT EXISTS platform_settings (
  id TEXT PRIMARY KEY,
  support_email TEXT,
  support_whatsapp TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by TEXT
);
