/**
 * Shared plumbing every domain module in src/lib/api/ depends on.
 *
 * MOCK_MODE = true  -> everything is stored in the browser (localStorage)
 * MOCK_MODE = false -> calls hit your real Cloudflare Worker (see /worker)
 */
export const MOCK_MODE = false;
export const API_BASE = import.meta.env.VITE_API_BASE || "https://your-worker.your-subdomain.workers.dev";

export function lsGet(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function lsSet(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : `p_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export function currentSession() {
  return lsGet("chilimba:session", null);
}

export function logout() {
  localStorage.removeItem("chilimba:session");
}

/**
 * Builds a mock-mode storage key scoped to the current session's group —
 * e.g. groupScopedKey(session, "ledger", "harriet") ->
 * "chilimba:ledger:hillcrest:harriet". Every domain module's mock branch
 * goes through this rather than building group-scoped keys by hand, so
 * the scoping rule lives in exactly one place. For a group-wide key with
 * no per-user segment, just pass one part: groupScopedKey(session, "fund-contributions").
 */
export function groupScopedKey(session, domain, ...rest) {
  if (!session?.groupSlug) throw new Error("Not signed in to a group.");
  return ["chilimba", domain, session.groupSlug, ...rest].join(":");
}

export async function realFetch(path, opts = {}) {
  const session = currentSession();
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {}),
    },
    ...opts,
  });
  if (!res.ok) {
    // Every route in worker/src/routes/ throws an HttpError with a
    // specific, user-facing message (e.g. "That group code is already
    // taken", "This group is on the free plan...") which index.js
    // returns as {error: "..."} — this used to be discarded entirely in
    // favor of a generic "API error 409", so every one of those
    // messages was silently unreachable in real (non-mock) mode. Falls
    // back to the generic form only if the body isn't the expected
    // shape (a malformed response, a proxy's own error page, etc.).
    const body = await res.json().catch(() => null);
    throw new Error(body?.error || `API error ${res.status}`);
  }
  return res.json();
}
