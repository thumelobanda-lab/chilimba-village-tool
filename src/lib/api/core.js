/**
 * Shared plumbing every domain module in src/lib/api/ depends on.
 *
 * MOCK_MODE = true  -> everything is stored in the browser (localStorage)
 * MOCK_MODE = false -> calls hit your real Cloudflare Worker (see /worker)
 *
 * Driven by VITE_MOCK_MODE so it can vary per Cloudflare Pages
 * environment (Production / Preview) without touching this file —
 * previously a deploy script patched this line in place with sed,
 * which doesn't work once builds run from a Git push instead of a
 * local script. Unset (plain `npm run dev`, no .env) defaults to mock
 * mode so a fresh clone works with no backend.
 */
import { dequeue, enqueue } from "../offlineQueue.js";

export const MOCK_MODE = import.meta.env.VITE_MOCK_MODE !== "false";
export const API_BASE = import.meta.env.VITE_API_BASE || "https://your-worker.your-subdomain.workers.dev";

// A fetch is given this long to complete before it's treated the same as
// a hard network failure — without it, a request over a genuinely bad
// connection (the exact "patchy mobile data" case this exists for) can
// hang far longer than a user will wait, instead of falling back to
// cached data / queueing the write the way an outright offline fetch
// already does.
const FETCH_TIMEOUT_MS = 8000;

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

// ---------- Offline-first: read cache + write outbox ----------
// See offlineQueue.js for the pure enqueue/dequeue/overlay rules this
// wires into actual storage and fetch. Two separate mechanisms, both
// scoped by group + signed-in member (never just by URL path, since two
// different members share the same path e.g. "/api/contributions/me"):
//
// - Every successful GET response is cached; a GET that fails purely for
//   connectivity reasons (never reached the server) falls back to that
//   cache instead of throwing, so a screen showing data the member has
//   already loaded once stays populated offline instead of going blank.
// - Every non-GET (write) that fails the same way is queued instead of
//   lost, and replayed in order the next time flushOutbox() runs — see
//   useOfflineSync.js for when that is (the browser's "online" event,
//   plus once on app start in case the tab was reopened already-online
//   with a stale queue).
function readCacheKey(session, path) {
  return `chilimba:read-cache:${session.groupSlug}:${session.name.toLowerCase()}:${path}`;
}
function outboxKey(session) {
  return `chilimba:outbox:${session.groupSlug}:${session.name.toLowerCase()}`;
}

// fetch() rejects with a generic TypeError for any connectivity-level
// failure (offline, DNS, connection refused, a CORS preflight that never
// got a response) — there's no more specific browser signal to tell
// those apart, and nothing here needs one: all of them mean "couldn't
// reach the server just now," exactly the case this fallback exists for.
// The AbortError our own FETCH_TIMEOUT_MS produces counts the same way.
function isConnectivityFailure(e) {
  return e?.name === "TypeError" || e?.name === "AbortError";
}

async function fetchWithTimeout(url, opts) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...opts, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// Every outbox mutation fires this so useOfflineSync's pending-count
// badge updates immediately (queue, flush, or a manual retry) without
// polling localStorage on a timer.
const outboxListeners = new Set();
function notifyOutboxChange() {
  outboxListeners.forEach((cb) => cb());
}
export function subscribeOutbox(cb) {
  outboxListeners.add(cb);
  return () => outboxListeners.delete(cb);
}

export function loadOutbox(session) {
  if (!session) return [];
  return lsGet(outboxKey(session), []);
}
function saveOutbox(session, outbox) {
  lsSet(outboxKey(session), outbox);
  notifyOutboxChange();
}

export function pendingSyncCount() {
  return loadOutbox(currentSession()).length;
}

// True unless the browser has actively told us the network is down.
// Deliberately NOT used to decide whether to attempt a fetch at all
// (navigator.onLine reflects "connected to a network," not "the
// internet is reachable," so it can read true on a captive portal or a
// dead connection) — only realFetch's own timed-out/rejected fetch is
// treated as authoritative for that. This is for the UI banner only.
export function isOnline() {
  return typeof navigator === "undefined" || navigator.onLine !== false;
}

function handleOffline(session, path, method, body, headers) {
  if (method === "GET") {
    if (!session) throw new Error("You're offline. Connect to the internet to sign in.");
    const cached = lsGet(readCacheKey(session, path), null);
    if (cached) return { ...cached.data, _offline: true, _cachedAt: cached.cachedAt };
    throw new Error("You're offline, and this hasn't loaded on this device before.");
  }
  if (!session) throw new Error("You're offline. Connect to the internet to sign in.");
  const item = {
    id: uid(),
    path,
    method,
    body,
    headers,
    groupSlug: session.groupSlug,
    memberName: session.name,
    createdAt: new Date().toISOString(),
  };
  saveOutbox(session, enqueue(loadOutbox(session), item));
  // Callers never branch on this beyond `.ok`/an occasional `.id` (see
  // addPayment in contributions.js, which already generates its own
  // client-side id before this is ever called) — queued and genuinely
  // synced both need to look like success to code that just does
  // `await write(); await reload();`.
  return { ok: true, queued: true, ...(body?.id ? { id: body.id } : {}) };
}

export async function realFetch(path, opts = {}) {
  const session = currentSession();
  const method = (opts.method || "GET").toUpperCase();
  const headers = {
    "Content-Type": "application/json",
    ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {}),
  };

  let res;
  try {
    res = await fetchWithTimeout(`${API_BASE}${path}`, { ...opts, headers });
  } catch (e) {
    if (!isConnectivityFailure(e)) throw e;
    const body = opts.body ? JSON.parse(opts.body) : null;
    return handleOffline(session, path, method, body, headers);
  }

  if (!res.ok) {
    // Every route in worker/src/routes/ throws an HttpError with a
    // specific, user-facing message (e.g. "That group code is already
    // taken", "This group is on the free plan...") which index.js
    // returns as {error: "..."} — this used to be discarded entirely in
    // favor of a generic "API error 409", so every one of those
    // messages was silently unreachable in real (non-mock) mode. Falls
    // back to the generic form only if the body isn't the expected
    // shape (a malformed response, a proxy's own error page, etc.).
    // Deliberately NOT queued — the request reached the server and it
    // said no, so retrying it unchanged would just fail the same way.
    const body = await res.json().catch(() => null);
    throw new Error(body?.error || `API error ${res.status}`);
  }
  const json = await res.json();
  if (method === "GET" && session) {
    lsSet(readCacheKey(session, path), { data: json, cachedAt: new Date().toISOString() });
  }
  return json;
}

// Replays every queued write for the signed-in member, in the order
// they were made (so e.g. an add and a later void of the same payment
// can't land out of order). Stops at the first item that still can't
// reach the server — rather than skipping past it — since the outbox is
// a FIFO ledger of real actions, and everything after it in real time
// happened after it in the app too. A write the server actively
// rejects (not a connectivity failure — it reached the server and got a
// real error back) is dropped: retrying it unchanged would only fail
// the same way again forever, silently blocking every write behind it.
export async function flushOutbox() {
  const session = currentSession();
  if (!session) return { synced: 0, remaining: 0 };
  let outbox = loadOutbox(session);
  let synced = 0;

  for (const item of outbox) {
    let res;
    try {
      res = await fetchWithTimeout(`${API_BASE}${item.path}`, {
        method: item.method,
        headers: item.headers,
        body: item.body ? JSON.stringify(item.body) : undefined,
      });
    } catch (e) {
      if (isConnectivityFailure(e)) break; // still offline — try the rest next time
      outbox = dequeue(outbox, item.id);
      saveOutbox(session, outbox);
      continue;
    }
    if (!res.ok) {
      outbox = dequeue(outbox, item.id);
      saveOutbox(session, outbox);
      continue;
    }
    outbox = dequeue(outbox, item.id);
    saveOutbox(session, outbox);
    synced++;
  }

  return { synced, remaining: outbox.length };
}
