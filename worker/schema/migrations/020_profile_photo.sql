-- Migration 020: profile photos.
--
-- users.photo_key is a reference into R2 (see the AVATARS binding in
-- wrangler.toml), not the image itself — D1 isn't a good place to hold
-- binary blobs at any real scale. The key is deterministic
-- (avatars/<groupId>/<userId>, see routes/profilePhoto.js), so it's
-- really just a "does this member have a photo right now" flag; NULL
-- means no photo. A member's own photo is self-service (upload/remove,
-- same "acts on the signed-in session only" rule as displayName/PIN in
-- routes/profile.js) and visible to every member of their group, same
-- as the roster (see /api/members/roster) — never gated to admins, and
-- never deleted just because the member themselves is soft-removed
-- (same "payment history stays intact" convention as everything else
-- removeMember touches).
--
-- Apply with:
--   scripts/apply-migration.sh worker/schema/migrations/020_profile_photo.sql

ALTER TABLE users ADD COLUMN photo_key TEXT;
