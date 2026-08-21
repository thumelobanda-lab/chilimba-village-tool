import { API_BASE } from "./core.js";

/**
 * Platform-owner API client — deliberately separate from every other
 * module in this directory. Its session lives under its own localStorage
 * key (chilimba:owner-session, not chilimba:session), so there's no
 * shared storage a bug could confuse with a group session, and it always
 * hits the real Worker — there's no mock-mode branch here, the same way
 * the reminder cron sweep has none: this only makes sense against a real
 * deployed backend with a real owner account (see scripts/create-owner.sh).
 */
const OWNER_SESSION_KEY = "chilimba:owner-session";

export function currentOwnerSession() {
  try {
    const raw = localStorage.getItem(OWNER_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function ownerLogout() {
  const session = currentOwnerSession();
  localStorage.removeItem(OWNER_SESSION_KEY);
  if (session?.token) {
    // Best-effort — the local session is already cleared either way, so
    // a failed request here (e.g. offline) never leaves the owner stuck
    // signed in on this device.
    fetch(`${API_BASE}/api/owner/logout`, {
      method: "POST",
      headers: { Authorization: `Bearer ${session.token}` },
    }).catch(() => {});
  }
}

async function ownerFetch(path, opts = {}) {
  const session = currentOwnerSession();
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {}),
    },
    ...opts,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error || `API error ${res.status}`);
  }
  return res.json();
}

export async function ownerLogin(email, password) {
  const session = await ownerFetch("/api/owner/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  localStorage.setItem(OWNER_SESSION_KEY, JSON.stringify(session));
  return session;
}

export function getOwnerOverview() {
  return ownerFetch("/api/owner/overview");
}

export function getOwnerGroups() {
  return ownerFetch("/api/owner/groups");
}

export function getPendingSubscriptions() {
  return ownerFetch("/api/owner/subscriptions/pending");
}

export function confirmSubscription(id) {
  return ownerFetch(`/api/owner/subscriptions/${id}/confirm`, { method: "POST" });
}

export function rejectSubscription(id, notes = "") {
  return ownerFetch(`/api/owner/subscriptions/${id}/reject`, {
    method: "POST",
    body: JSON.stringify({ notes }),
  });
}

export function suspendGroup(id, reason) {
  return ownerFetch(`/api/owner/groups/${id}/suspend`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export function unsuspendGroup(id) {
  return ownerFetch(`/api/owner/groups/${id}/unsuspend`, { method: "POST" });
}

// The member picker behind "a specific person" — one group's active
// roster (name, role, phone) for OwnerMessaging.jsx's target dropdown.
export function getOwnerGroupMembers(groupId) {
  return ownerFetch(`/api/owner/groups/${groupId}/members`);
}

// Sends a one-way platform message — targetType is 'user' | 'group_admins'
// | 'group_members'; userId only applies (and is required) for 'user'.
// Returns { id, recipientCount, recipients: [{id, name, phone}] } — the
// recipients array is what OwnerMessaging.jsx uses to offer a per-person
// WhatsApp share link (buildWhatsAppShareUrl, lib/inviteCard.js) when
// alsoWhatsApp is set; sending itself never contacts WhatsApp server-side.
export function sendOwnerMessage({ groupId, targetType, userId, message, alsoWhatsApp, category }) {
  return ownerFetch("/api/owner/messages", {
    method: "POST",
    // category is a label for the owner's own log only (see
    // messageTemplates.js) — omitted (not an empty string) when no
    // template was used, so the Worker's isValidCategory sees "no
    // category" rather than an unrecognized value.
    body: JSON.stringify({ groupId, targetType, userId, message, alsoWhatsApp, category: category || undefined }),
  });
}

// The owner's own log of everything sent — recipient (targetLabel),
// content, timestamp — newest first.
export function getOwnerMessages() {
  return ownerFetch("/api/owner/messages");
}

// The platform-wide support contact behind templates' [Contact]
// placeholder (see lib/messageTemplates.js) — a singleton, shared by
// every owner account, set once here rather than per-message.
export function getOwnerSettings() {
  return ownerFetch("/api/owner/settings");
}

export function updateOwnerSettings({ supportEmail, supportWhatsapp }) {
  return ownerFetch("/api/owner/settings", {
    method: "PUT",
    body: JSON.stringify({ supportEmail, supportWhatsapp }),
  });
}
