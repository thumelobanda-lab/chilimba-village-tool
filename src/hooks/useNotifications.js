import { useMemo, useState } from "react";
import { getMyMessages, markMessageRead, getNotices } from "../lib/api.js";
import { useApiData } from "../lib/useApiData.js";
import { groupScopedKey, lsGet, lsSet } from "../lib/api/core.js";
import { recentPaymentEvents, paymentEventId, isReminderDue } from "../lib/notifications.js";
import { parseServerTimestamp } from "../lib/serverTime.js";
import { relativeDueLabel, daysUntil } from "../lib/dashboardMath.js";
import { money } from "../components/LedgerTable.jsx";

function dismissedKey(session) {
  return groupScopedKey(session, "dismissed-notifications", session.name.toLowerCase());
}

function getDismissed(session) {
  return new Set(lsGet(dismissedKey(session), []));
}

function addDismissed(session, id) {
  const next = getDismissed(session);
  next.add(id);
  lsSet(dismissedKey(session), [...next]);
}

/**
 * Powers the notification bell — one combined, dismissible list across
 * every source that currently has no other in-app "you have something
 * new" signal: platform-owner direct messages, group notices, a recent
 * confirm/reject decision on one of the member's own payments, and an
 * in-app echo of an upcoming due date (the same information a push/SMS
 * reminder carries, for whoever's looking at the app instead).
 *
 * Owner messages already have real, server-side read state (see
 * lib/api/messages.js) — dismissing one there marks it read for good.
 * Everything else has no backend concept of "seen" per member, so it's
 * dismissed-by-id in localStorage, the same pattern already used by
 * PayoutAcknowledgment.jsx and SubscriptionExpiryBanner.jsx: dismissing
 * a notice or a payment-status change hides that one specific item
 * forever, not "everything as of now" — simpler to reason about, and
 * nothing is ever silently marked read without the member seeing it.
 */
export function useNotifications(session, payments, nextDue, premiumActive) {
  const { data: ownerData, refresh: refreshOwner } = useApiData(
    session ? getMyMessages : () => Promise.resolve(null),
    [session?.token]
  );
  const { data: noticesData } = useApiData(
    session ? getNotices : () => Promise.resolve(null),
    [session?.token]
  );
  // Bumped after every dismiss to force items[] to re-derive against the
  // freshly-written localStorage set — the set itself isn't React state,
  // so nothing else would tell this hook it changed.
  const [dismissTick, setDismissTick] = useState(0);

  const items = useMemo(() => {
    if (!session) return [];
    const dismissed = getDismissed(session);
    const out = [];

    for (const m of ownerData?.messages || []) {
      out.push({
        id: `owner-${m.recipientId}`,
        kind: "owner",
        text: m.message,
        at: m.sentAt,
        dismiss: async () => {
          await markMessageRead(m.recipientId);
          await refreshOwner();
        },
      });
    }

    for (const n of noticesData?.notices || []) {
      const id = `notice-${n.id}`;
      if (dismissed.has(id)) continue;
      out.push({
        id,
        kind: "notice",
        text: n.message,
        at: n.postedAt,
        dismiss: () => {
          addDismissed(session, id);
          setDismissTick((t) => t + 1);
        },
      });
    }

    for (const p of recentPaymentEvents(payments)) {
      const id = paymentEventId(p);
      if (dismissed.has(id)) continue;
      out.push({
        id,
        kind: "payment",
        text: p.rejectedAt
          ? `Your ${money(p.amount)} payment wasn't confirmed${p.rejectionReason ? `: ${p.rejectionReason}` : "."}`
          : `Your ${money(p.amount)} payment was confirmed.${premiumActive ? " Receipt ready in My Payment History." : ""}`,
        at: p.rejectedAt || p.confirmedAt,
        dismiss: () => {
          addDismissed(session, id);
          setDismissTick((t) => t + 1);
        },
      });
    }

    if (nextDue && isReminderDue(nextDue.row.date)) {
      const id = `reminder-${nextDue.row.id}`;
      if (!dismissed.has(id)) {
        out.push({
          id,
          kind: "reminder",
          text: `Your ${money(nextDue.balance)} payment — ${relativeDueLabel(daysUntil(nextDue.row.date))}.`,
          at: null,
          dismiss: () => {
            addDismissed(session, id);
            setDismissTick((t) => t + 1);
          },
        });
      }
    }

    return out.sort((a, b) => (parseServerTimestamp(b.at) || 0) - (parseServerTimestamp(a.at) || 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, ownerData, noticesData, payments, nextDue, dismissTick, premiumActive]);

  return { items, unreadCount: items.length };
}
