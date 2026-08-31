import { useCallback, useMemo, useState } from "react";
import { groupScopedKey, lsGet, lsSet } from "../lib/api/core.js";

function seenKey(session) {
  return groupScopedKey(session, "seen-receipts", session.name.toLowerCase());
}

function getSeen(session) {
  return new Set(lsGet(seenKey(session), []));
}

/**
 * Derives the member's full receipt list from the ledger they already
 * have loaded (a receipt is just a confirmed, non-voided payment entry —
 * see receipt.js's doc comment, no separate record to fetch) and tracks
 * which ones this member has actually opened "My Receipts" to see.
 *
 * "Seen" is per-member localStorage, same dismissed-by-id pattern as
 * useNotifications.js's notice/payment dismissals — but framed positively
 * (has this been looked at) rather than dismissed, since a receipt never
 * goes away, it just stops being new.
 */
export function useReceipts(session, rowsComputed) {
  const [seenTick, setSeenTick] = useState(0);

  const receipts = useMemo(() => {
    const list = [];
    for (const row of rowsComputed || []) {
      for (const e of row.entries) {
        if (!e.voidedAt && e.confirmedAt) list.push({ entry: e, row });
      }
    }
    return list.sort((a, b) => new Date(b.entry.confirmedAt) - new Date(a.entry.confirmedAt));
  }, [rowsComputed]);

  const unseenCount = useMemo(() => {
    if (!session) return 0;
    const seen = getSeen(session);
    return receipts.filter((r) => !seen.has(r.entry.id)).length;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, receipts, seenTick]);

  const markAllSeen = useCallback(() => {
    if (!session || receipts.length === 0) return;
    const seen = getSeen(session);
    let changed = false;
    for (const r of receipts) {
      if (!seen.has(r.entry.id)) {
        seen.add(r.entry.id);
        changed = true;
      }
    }
    if (changed) {
      lsSet(seenKey(session), [...seen]);
      setSeenTick((t) => t + 1);
    }
  }, [session, receipts]);

  return { receipts, unseenCount, markAllSeen };
}
