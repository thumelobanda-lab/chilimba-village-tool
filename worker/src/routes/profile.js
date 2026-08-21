import { requireSession } from "../auth.js";
import { hashPin, verifyPin, randomSalt } from "../crypto.js";
import { HttpError } from "../httpError.js";
import { json } from "../responses.js";

// Self-service editing of a member's own account — the two things
// changing here (display name, PIN) both live on the `users` row keyed
// by user.id from the session, so unlike group-scoped data there's no
// separate table to touch. Deliberately does NOT let a member change
// which name they log in with (see the displayName check below) — the
// lowercase `name` column is also what schedule payee matching
// (isRecipient() in scheduleUtils.js) and mock-mode's account/ledger
// keys are keyed on, so a true rename would silently break "am I this
// row's recipient" for every schedule row an admin already typed their
// old name into. A cosmetic capitalization/spelling fix is safe because
// it normalizes back to the same lowercase key; an actual rename is an
// admin's job (there's no self-service path for that, same as removing
// or promoting a member).
export default function registerProfileRoutes(router) {
  // Refreshes a member's own session info — name, role, group — from
  // the database. requireSession() already re-reads `role` fresh on
  // every authenticated request (see the comment in auth.js), so the
  // backend side of a promotion/demotion is correct the instant it
  // happens; what's stale is the frontend's cached session object,
  // which only gets set once at login. Called on window focus (see
  // useSession.js's refreshSession) so a member promoted in another tab
  // sees their new admin access without needing to sign out and back in.
  router.get("/api/me", async ({ request, env, cors }) => {
    const session = await requireSession(request, env);
    return json({
      name: session.name,
      role: session.role,
      groupSlug: session.groupSlug,
      groupName: session.groupName,
    }, 200, cors);
  });

  router.put("/api/me", async ({ request, env, cors }) => {
    const session = await requireSession(request, env);
    const { displayName, currentPin, newPin } = await request.json();

    const wantsNameChange = typeof displayName === "string" && displayName.trim();
    const wantsPinChange = typeof newPin === "string" && newPin;
    if (!wantsNameChange && !wantsPinChange) {
      throw new HttpError(400, "Nothing to update.");
    }

    const user = await env.DB.prepare(`SELECT * FROM users WHERE id = ?`).bind(session.id).first();
    if (!user) throw new HttpError(404, "Account not found.");

    let nextDisplayName = user.display_name;
    if (wantsNameChange) {
      const trimmed = displayName.trim();
      if (trimmed.toLowerCase() !== user.name) {
        throw new HttpError(
          400,
          "You can only change spelling or capitalization here — ask an admin to change your name to something else."
        );
      }
      nextDisplayName = trimmed;
    }

    let pinSalt = user.pin_salt;
    let pinHash = user.pin_hash;
    if (wantsPinChange) {
      if (!currentPin) throw new HttpError(400, "Enter your current PIN to set a new one.");
      const ok = await verifyPin(currentPin, user.pin_salt, user.pin_hash);
      if (!ok) throw new HttpError(401, "Current PIN is incorrect.");
      if (newPin.length < 4) throw new HttpError(400, "New PIN must be at least 4 digits.");
      pinSalt = randomSalt();
      pinHash = await hashPin(newPin, pinSalt);
    }

    await env.DB.prepare(
      `UPDATE users SET display_name = ?, pin_salt = ?, pin_hash = ? WHERE id = ?`
    ).bind(nextDisplayName, pinSalt, pinHash, user.id).run();

    return json({ name: nextDisplayName }, 200, cors);
  });
}
