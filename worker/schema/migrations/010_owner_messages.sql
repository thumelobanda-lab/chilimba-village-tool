-- Migration 010: platform-owner direct messaging.
--
-- Lets a platform owner send a one-way message to a specific member/admin,
-- every admin of a group, or every member of a group — separate from
-- notices (an ADMIN's own announcement to THEIR OWN group's members,
-- worker/src/routes/notices.js), which stays untouched. This is the
-- owner's channel, not a group's.
--
-- owner_messages is the log the owner dashboard reads (one row per send,
-- with a target_label snapshot computed at send time so the log stays
-- readable even if the group/user is later renamed or removed).
-- owner_message_recipients is the fan-out: one row per actually-resolved
-- recipient, each with its own read_at — this is what a member's own
-- GET /api/messages reads, filtered strictly by their own user_id.
--
-- Isolation: the ONLY route that can INSERT into either table is
-- POST /api/owner/messages, gated by requireOwner (owner_sessions) —
-- never requireAdmin or requireSession. A group admin has no route that
-- writes here, and their own read access (GET /api/messages,
-- POST /api/messages/:id/read) is scoped by `user_id = <their own
-- session's user id>` in every query, so they can only ever see or
-- dismiss messages addressed to themselves — never another member's,
-- and never send one at all.
--
-- Apply with:
--   npx wrangler d1 execute chilimba-db --remote --file=./schema/migrations/010_owner_messages.sql

CREATE TABLE IF NOT EXISTS owner_messages (
  id TEXT PRIMARY KEY,
  target_type TEXT NOT NULL,        -- 'user' | 'group_admins' | 'group_members'
  group_id TEXT NOT NULL REFERENCES groups(id),
  user_id TEXT REFERENCES users(id),  -- set only when target_type = 'user'
  target_label TEXT NOT NULL,       -- snapshot, e.g. "Harriet Banda (Hillcrest Chilimba)"
                                     -- or "All admins — Hillcrest Chilimba"
  message TEXT NOT NULL,
  whatsapp_requested INTEGER NOT NULL DEFAULT 0, -- owner also wanted WhatsApp
                                     -- share links prepared for this send (see
                                     -- buildWhatsAppShareUrl, src/lib/inviteCard.js) —
                                     -- recorded for the owner's own log; actually
                                     -- opening WhatsApp always stays a manual,
                                     -- per-recipient tap client-side, same as the
                                     -- existing invite-card/receipt share pattern,
                                     -- since there's no server-side WhatsApp send
                                     -- integration in this codebase
  sent_by TEXT NOT NULL,            -- owner email
  sent_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_owner_messages_sent ON owner_messages(sent_at);

CREATE TABLE IF NOT EXISTS owner_message_recipients (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL REFERENCES owner_messages(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  read_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_owner_message_recipients_user ON owner_message_recipients(user_id, read_at);
