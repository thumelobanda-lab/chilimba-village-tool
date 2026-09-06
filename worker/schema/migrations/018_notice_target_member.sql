-- Migration 018: let an admin address a notice to one member instead of
-- the whole group.
--
-- notices.target_member_name is nullable — NULL keeps today's behavior
-- (a broadcast, visible to every member). Set to a member's display
-- name, it's a direct notice: only that member (and any admin, who can
-- see and manage every notice in their group) sees it in the feed. A
-- name rather than a user_id foreign key on purpose, matching how the
-- rest of this app already scopes things (ledger, due_overrides) by
-- display name within a group, not a member's row id.
--
-- Apply with:
--   npx wrangler d1 execute chilimba-db --remote --file=./schema/migrations/018_notice_target_member.sql

ALTER TABLE notices ADD COLUMN target_member_name TEXT;
