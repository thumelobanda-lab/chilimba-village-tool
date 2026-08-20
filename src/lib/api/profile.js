import { randomSalt, hashPin, verifyPin } from "../crypto.js";
import { MOCK_MODE, lsGet, lsSet, realFetch, currentSession, groupScopedKey } from "./core.js";

function normalizeKey(name) {
  return (name || "").trim().toLowerCase();
}

// Self-service editing of the signed-in member's own account: a
// cosmetic display-name fix and/or a PIN change. Deliberately does NOT
// support renaming to a different name — the lowercase name is also
// what schedule payee matching (isRecipient() in scheduleUtils.js) and
// every mock-mode storage key (ledger, reminders, account) are keyed
// on, so this only accepts an edit that still normalizes to the same
// key. See worker/src/routes/profile.js for the server-side twin of
// this same rule.
export async function updateProfile({ displayName, currentPin, newPin } = {}) {
  const session = currentSession();
  if (!session) throw new Error("Not signed in.");

  const wantsNameChange = !!(displayName && displayName.trim());
  const wantsPinChange = !!newPin;
  if (!wantsNameChange && !wantsPinChange) throw new Error("Nothing to update.");

  if (MOCK_MODE) {
    const key = groupScopedKey(session, "account", normalizeKey(session.name));
    const account = lsGet(key, null);
    if (!account) throw new Error("Account not found.");

    let nextDisplayName = session.name;
    if (wantsNameChange) {
      const trimmed = displayName.trim();
      if (normalizeKey(trimmed) !== normalizeKey(session.name)) {
        throw new Error("You can only change spelling or capitalization here — ask an admin to change your name to something else.");
      }
      nextDisplayName = trimmed;
    }

    let nextAccount = account;
    if (wantsPinChange) {
      if (!currentPin) throw new Error("Enter your current PIN to set a new one.");
      const ok = await verifyPin(currentPin, account.salt, account.hash);
      if (!ok) throw new Error("Current PIN is incorrect.");
      if (newPin.length < 4) throw new Error("New PIN must be at least 4 digits.");
      const salt = randomSalt();
      const hash = await hashPin(newPin, salt);
      nextAccount = { ...account, salt, hash };
    }
    lsSet(key, nextAccount);

    const nextSession = { ...session, name: nextDisplayName };
    lsSet("chilimba:session", nextSession);
    return { name: nextDisplayName };
  }

  const result = await realFetch("/api/me", {
    method: "PUT",
    body: JSON.stringify({ displayName, currentPin, newPin }),
  });
  lsSet("chilimba:session", { ...session, name: result.name || session.name });
  return result;
}
