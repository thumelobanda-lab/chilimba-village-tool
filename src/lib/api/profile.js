import { randomSalt, hashPin, verifyPin } from "../crypto.js";
import { MOCK_MODE, lsGet, lsSet, realFetch, currentSession, groupScopedKey } from "./core.js";
import { normalizeTitle } from "./auth.js";

export const MOMO_PROVIDERS = ["MTN", "Airtel"];

function normalizeKey(name) {
  return (name || "").trim().toLowerCase();
}

// Re-reads the signed-in member's own role/name/group fresh from
// storage — the read-only counterpart to updateProfile() below. Used by
// useSession.js's refreshSession() to catch up a session that's gone
// stale (most notably: promoted to admin in another tab/session) without
// requiring a sign-out and back in. requireSession() on the Worker side
// already re-checks `role` from the users table on every authenticated
// call (see the comment in worker/src/auth.js) — this endpoint doesn't
// change that, it just lets the frontend's cached session object catch
// up to what the backend already knows.
export async function getMe() {
  const session = currentSession();
  if (!session) throw new Error("Not signed in.");

  let fresh;
  if (MOCK_MODE) {
    const key = groupScopedKey(session, "account", normalizeKey(session.name));
    const account = lsGet(key, null);
    if (!account || account.active === false) throw new Error("Session no longer valid.");
    fresh = {
      name: session.name,
      role: account.role || "member",
      title: account.title || null,
      groupSlug: session.groupSlug,
      groupName: session.groupName,
    };
  } else {
    fresh = await realFetch("/api/me");
  }

  // Persist immediately, same as updateProfile() below does for a name
  // change — so a page reload picks up the refreshed role too, not just
  // the in-memory session useSession.js's refreshSession() updates.
  lsSet("chilimba:session", { ...session, ...fresh });
  return fresh;
}

// Self-service editing of the signed-in member's own account: a
// cosmetic display-name fix and/or a PIN change. Deliberately does NOT
// support renaming to a different name — the lowercase name is also
// what schedule payee matching (isRecipient() in scheduleUtils.js) and
// every mock-mode storage key (ledger, reminders, account) are keyed
// on, so this only accepts an edit that still normalizes to the same
// key. See worker/src/routes/profile.js for the server-side twin of
// this same rule.
export async function updateProfile({ displayName, currentPin, newPin, title } = {}) {
  const session = currentSession();
  if (!session) throw new Error("Not signed in.");

  const wantsNameChange = !!(displayName && displayName.trim());
  const wantsPinChange = !!newPin;
  const wantsTitleChange = title !== undefined;
  if (!wantsNameChange && !wantsPinChange && !wantsTitleChange) throw new Error("Nothing to update.");

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
    const nextTitle = wantsTitleChange ? normalizeTitle(title) : account.title || null;
    if (wantsTitleChange) nextAccount = { ...nextAccount, title: nextTitle };
    lsSet(key, nextAccount);

    const nextSession = { ...session, name: nextDisplayName, title: nextTitle };
    lsSet("chilimba:session", nextSession);
    return { name: nextDisplayName, title: nextTitle };
  }

  const result = await realFetch("/api/me", {
    method: "PUT",
    body: JSON.stringify({ displayName, currentPin, newPin, title }),
  });
  lsSet("chilimba:session", { ...session, name: result.name || session.name, title: wantsTitleChange ? result.title : session.title });
  return result;
}

// The signed-in member's OWN mobile money payout recipient, in full —
// never masked to the account owner themselves (see getGroupMembers()
// in members.js for the masked, admin-facing view of the same data).
// Separate from their login `phone` since the two can legitimately
// differ. Data field and UI only, per docs/momo-integration-scope.md —
// this never triggers a real charge or payout.
export async function getMyMomoInfo() {
  const session = currentSession();
  if (!session) throw new Error("Not signed in.");

  if (MOCK_MODE) {
    const key = groupScopedKey(session, "account", normalizeKey(session.name));
    const account = lsGet(key, null);
    if (!account) throw new Error("Account not found.");
    return { provider: account.momoProvider || null, phone: account.momoPhone || null };
  }

  return realFetch("/api/me/momo");
}

// Saves the signed-in member's own mobile money payout recipient.
// Confirmation ("Payouts will go to [masked number] on [provider] —
// confirm") happens client-side, in Profile.jsx, before this is ever
// called — there's no separate server-side confirmation step, same as
// every other self-service field on this account.
export async function updateMyMomoInfo({ provider, phone } = {}) {
  const session = currentSession();
  if (!session) throw new Error("Not signed in.");
  if (!MOMO_PROVIDERS.includes(provider)) throw new Error("Choose MTN or Airtel.");
  if (!phone || !phone.trim()) throw new Error("A mobile money number is required.");

  if (MOCK_MODE) {
    const key = groupScopedKey(session, "account", normalizeKey(session.name));
    const account = lsGet(key, null);
    if (!account) throw new Error("Account not found.");
    lsSet(key, { ...account, momoProvider: provider, momoPhone: phone.trim() });
    return { ok: true };
  }

  return realFetch("/api/me/momo", {
    method: "PUT",
    body: JSON.stringify({ provider, phone: phone.trim() }),
  });
}
