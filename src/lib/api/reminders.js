import { MOCK_MODE, lsGet, lsSet, realFetch, currentSession, groupScopedKey } from "./core.js";

export async function getReminderPrefs() {
  const session = currentSession();
  if (!session) throw new Error("Not signed in.");
  if (MOCK_MODE) {
    return lsGet(groupScopedKey(session, "reminders", session.name.toLowerCase()), {
      pushEnabled: false, smsEnabled: false, phone: "", leadDays: 2,
    });
  }
  return realFetch("/api/reminders/prefs");
}

export async function saveReminderPrefs(prefs) {
  const session = currentSession();
  if (!session) throw new Error("Not signed in.");
  if (MOCK_MODE) {
    lsSet(groupScopedKey(session, "reminders", session.name.toLowerCase()), prefs);
    return { ok: true };
  }
  return realFetch("/api/reminders/prefs", { method: "PUT", body: JSON.stringify(prefs) });
}

// A member's own per-date overrides — no entry for a date means "use my
// default lead time" from getReminderPrefs above.
export async function getReminderDateOverrides() {
  const session = currentSession();
  if (!session) throw new Error("Not signed in.");
  if (MOCK_MODE) {
    return { overrides: lsGet(groupScopedKey(session, "reminder-date-overrides", session.name.toLowerCase()), {}) };
  }
  return realFetch("/api/reminders/date-overrides");
}

// Sets a custom lead time and/or mutes reminders for one specific date.
// Passing { leadDays: null, muted: false } clears the override entirely,
// falling back to the blanket default.
export async function setReminderDateOverride(scheduleRowId, { leadDays, muted }) {
  const session = currentSession();
  if (!session) throw new Error("Not signed in.");

  if (MOCK_MODE) {
    const key = groupScopedKey(session, "reminder-date-overrides", session.name.toLowerCase());
    const overrides = lsGet(key, {});
    if ((leadDays === null || leadDays === undefined) && !muted) {
      delete overrides[scheduleRowId];
    } else {
      overrides[scheduleRowId] = { leadDays: leadDays ?? null, muted: !!muted };
    }
    lsSet(key, overrides);
    return { ok: true };
  }

  return realFetch(`/api/reminders/date-overrides/${scheduleRowId}`, {
    method: "PUT",
    body: JSON.stringify({ leadDays: leadDays ?? null, muted: !!muted }),
  });
}

// Admin-only, on-demand single reminder — Dashboard.jsx's rotation-strip
// long-press shortcut. See worker/src/routes/reminders.js's send-now
// route for why this is deliberately not subscription-gated the way the
// automated sweep is. Mock mode has no other member's real device to
// send anything to, so it simulates the same "only sends through
// channels the member opted into" rule using their locally-stored
// reminder prefs (almost always the defaults, since nobody but the
// signed-in session ever writes to their own prefs in mock mode) —
// realistic enough for local dev without pretending to deliver anything.
export async function sendReminderNow(memberName) {
  const session = currentSession();
  if (!session) throw new Error("Not signed in.");
  if (MOCK_MODE) {
    const prefs = lsGet(groupScopedKey(session, "reminders", memberName.toLowerCase()), {
      pushEnabled: false, smsEnabled: false, phone: "", leadDays: 2,
    });
    if (!prefs.pushEnabled && !prefs.smsEnabled) {
      return { ok: false, reason: "This member hasn't enabled push or SMS reminders yet." };
    }
    return { ok: true };
  }
  return realFetch("/api/reminders/send-now", { method: "POST", body: JSON.stringify({ memberName }) });
}

export async function registerPushSubscription(subscription) {
  if (MOCK_MODE) return { ok: true }; // nothing to send server-side in mock mode
  return realFetch("/api/push/subscribe", { method: "POST", body: JSON.stringify(subscription.toJSON()) });
}

export async function unregisterPushSubscription(subscription) {
  if (MOCK_MODE) return { ok: true };
  return realFetch("/api/push/subscribe", {
    method: "DELETE",
    body: JSON.stringify({ endpoint: subscription.endpoint }),
  });
}
