import { useCallback, useEffect, useRef, useState } from "react";
import { flushOutbox, isOnline, pendingSyncCount, subscribeOutbox } from "../lib/api/core.js";

/**
 * Tracks connectivity and the offline write outbox (see core.js's
 * realFetch/flushOutbox), and flushes the outbox the moment the browser
 * comes back online — plus once on mount, in case the tab was reopened
 * already-online with a stale queue left over from last time (the
 * "online" event only fires on an actual transition, not on load).
 *
 * `onSynced` is called after a flush that actually moved at least one
 * item, so the caller can re-fetch from the now-authoritative server
 * (App.jsx reloads the ledger/config) instead of trusting the local
 * pendingSync overlay forever.
 */
export function useOfflineSync(onSynced) {
  const [online, setOnline] = useState(isOnline());
  const [pending, setPending] = useState(pendingSyncCount());
  const [syncing, setSyncing] = useState(false);
  // A ref, not state, for the re-entrancy guard — it needs to be read
  // synchronously inside flush() itself, not on whatever render last
  // created the callback.
  const syncingRef = useRef(false);
  // Kept in a ref (updated every render, read inside flush) rather than
  // a useCallback dependency — App.jsx passes a fresh inline closure on
  // every render, and putting it in flush's deps would tear down and
  // re-register the window online/offline listeners just as often for
  // no benefit; this way flush stays referentially stable while always
  // calling the latest onSynced.
  const onSyncedRef = useRef(onSynced);
  onSyncedRef.current = onSynced;

  const flush = useCallback(async () => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    setSyncing(true);
    try {
      const { synced } = await flushOutbox();
      if (synced > 0 && onSyncedRef.current) await onSyncedRef.current();
    } finally {
      syncingRef.current = false;
      setSyncing(false);
    }
  }, []);

  useEffect(() => subscribeOutbox(() => setPending(pendingSyncCount())), []);

  useEffect(() => {
    const handleOnline = () => {
      setOnline(true);
      flush();
    };
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    if (isOnline() && pendingSyncCount() > 0) flush();
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [flush]);

  return { online, pending, syncing };
}
