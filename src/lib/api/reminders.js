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
