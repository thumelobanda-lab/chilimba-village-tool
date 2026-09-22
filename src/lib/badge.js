/**
 * App-icon badge (Badging API) for pending reminders / unread
 * notifications — see useNotifications.js's `unreadCount`, the single
 * existing read/unread count this mirrors rather than computing its own.
 * Guarded for every browser without the API (most of them, still) and
 * for a supported one that rejects the call (permission/display-mode
 * restrictions) — a missing icon badge is never worth surfacing as an
 * error.
 */
export function setAppBadge(count) {
  if (typeof navigator === "undefined" || typeof navigator.setAppBadge !== "function") return;
  try {
    if (count > 0) {
      navigator.setAppBadge(count);
    } else if (typeof navigator.clearAppBadge === "function") {
      navigator.clearAppBadge();
    }
  } catch {
    // See module doc comment.
  }
}

export function clearAppBadge() {
  if (typeof navigator === "undefined" || typeof navigator.clearAppBadge !== "function") return;
  try {
    navigator.clearAppBadge();
  } catch {
    // See module doc comment.
  }
}
