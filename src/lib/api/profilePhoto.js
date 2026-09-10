import { MOCK_MODE, API_BASE, lsGet, lsSet, currentSession, groupScopedKey } from "./core.js";

const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function readAsDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Could not read that image."));
    reader.readAsDataURL(blob);
  });
}

// Uploads the signed-in member's OWN photo — there's no name/id
// parameter, same self-service-only rule as updateProfile() in
// profile.js. `blob` is expected to already be downscaled/compressed
// (see src/lib/imageResize.js) — this only re-validates type/size as a
// backstop, it doesn't do any resizing itself.
export async function uploadProfilePhoto(blob) {
  const session = currentSession();
  if (!session) throw new Error("Not signed in.");
  if (!ALLOWED_TYPES.has(blob.type)) throw new Error("Only JPEG, PNG, or WebP photos are supported.");
  if (blob.size > MAX_BYTES) throw new Error("That photo is too large — please use a smaller one.");

  if (MOCK_MODE) {
    const dataUrl = await readAsDataUrl(blob);
    const key = groupScopedKey(session, "account", session.name.toLowerCase());
    const account = lsGet(key, {});
    lsSet(key, { ...account, photoDataUrl: dataUrl });
    return { ok: true };
  }

  // Raw binary body, not JSON — realFetch() always JSON.stringifies and
  // sets Content-Type: application/json, so this bypasses it and talks
  // to the Worker directly. Not queued through the offline outbox like
  // every other write here: the outbox replays a JSON body verbatim
  // (see core.js's flushOutbox), which can't represent a Blob, and a
  // photo upload is the one write in this app where "just try again
  // once you're back online" is a fine, honest answer rather than a
  // silent data-loss risk (unlike a payment).
  const res = await fetch(`${API_BASE}/api/profile/photo`, {
    method: "POST",
    headers: {
      "Content-Type": blob.type,
      ...(session.token ? { Authorization: `Bearer ${session.token}` } : {}),
    },
    body: blob,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error || `Could not upload your photo (${res.status}).`);
  }
  return res.json();
}

export async function removeProfilePhoto() {
  const session = currentSession();
  if (!session) throw new Error("Not signed in.");

  if (MOCK_MODE) {
    const key = groupScopedKey(session, "account", session.name.toLowerCase());
    const account = lsGet(key, {});
    lsSet(key, { ...account, photoDataUrl: null });
    return { ok: true };
  }

  const res = await fetch(`${API_BASE}/api/profile/photo`, {
    method: "DELETE",
    headers: session.token ? { Authorization: `Bearer ${session.token}` } : {},
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error || `Could not remove your photo (${res.status}).`);
  }
  return res.json();
}

// Resolves a displayable image URL for ANY member of the signed-in
// member's own group (the Worker route enforces that group boundary
// server-side — see GET /api/profile/photo/:name). Callers should only
// call this when they already know the member has a photo (roster/
// Avatar.jsx check hasPhoto first) — it always does a real fetch in
// real mode, so calling it speculatively for every member with no photo
// would be a wasted round trip per member on every roster load.
//
// Returns a blob: URL in real mode — the caller owns revoking it
// (URL.revokeObjectURL) once done, same lifecycle as any object URL.
export async function getProfilePhotoUrl(name) {
  const session = currentSession();
  if (!session || !name) return null;

  if (MOCK_MODE) {
    const key = groupScopedKey(session, "account", name.trim().toLowerCase());
    const account = lsGet(key, {});
    return account.photoDataUrl || null;
  }

  const res = await fetch(`${API_BASE}/api/profile/photo/${encodeURIComponent(name.trim().toLowerCase())}`, {
    headers: session.token ? { Authorization: `Bearer ${session.token}` } : {},
  });
  if (!res.ok) return null;
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}
