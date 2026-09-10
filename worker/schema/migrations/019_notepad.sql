-- Migration 019: a member's own private scratchpad — one plain-text
-- field, not a separate table. Always read/written against the signed-in
-- session's own row (see routes/notepad.js), so there's no group_id/
-- user_id foreign-key scoping to get wrong the way a separate table
-- would need.
--
-- notepad_text is nullable — NULL/empty both mean "nothing written yet".
--
-- Apply with:
--   scripts/apply-migration.sh worker/schema/migrations/019_notepad.sql

ALTER TABLE users ADD COLUMN notepad_text TEXT;
