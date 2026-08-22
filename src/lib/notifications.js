/**
 * Pure logic behind the notification bell — which of a member's own
 * payment entries recently changed status, and whether their next
 * payment is coming up soon enough to echo in-app what a push/SMS
 * reminder would already say. Kept dependency-free so "is this worth
 * surfacing" is testable without rendering anything; the bell itself
 * (useNotifications.js, NotificationBell.jsx) combines this with owner
 * messages (already have real server-side read state) and group notices
 * (dismissed-by-id in localStorage, same pattern as PayoutAcknowledgment
 * and SubscriptionExpiryBanner already use elsewhere in this app).
 */

const DEFAULT_EVENT_WINDOW_DAYS = 21;
const DEFAULT_REMINDER_LEAD_DAYS = 3;

/** Stable id for one payment's confirm/reject decision — changes if it's ever reversed and redecided. */
export function paymentEventId(payment) {
  const at = payment.rejectedAt || payment.confirmedAt;
  return `payment-${payment.id}-${at}`;
}

/**
 * Non-voided payments whose confirm/reject decision happened recently
 * enough to still be worth a notification — older history is just the
 * ledger, not news.
 */
export function recentPaymentEvents(payments, now = new Date(), windowDays = DEFAULT_EVENT_WINDOW_DAYS) {
  return (payments || []).filter((p) => {
    if (p.voidedAt) return false;
    const at = p.rejectedAt || p.confirmedAt;
    if (!at) return false;
    const days = (now.getTime() - new Date(at).getTime()) / (24 * 60 * 60 * 1000);
    return days >= 0 && days <= windowDays;
  });
}

/**
 * Is the member's own next due date close enough that this is worth an
 * in-app echo of the reminder they'd otherwise only see via push/SMS?
 * Not a replacement for those — just a same-information surface for
 * whoever's looking at the bell instead.
 */
export function isReminderDue(nextDueDateISO, now = new Date(), leadDays = DEFAULT_REMINDER_LEAD_DAYS) {
  if (!nextDueDateISO) return false;
  // Compares two date-only values (local midnight to local midnight),
  // same as daysUntil() in dashboardMath.js — comparing a date-only
  // value against a full now-with-time-of-day (e.g. noon) would make
  // "due today" read as already past whenever now is later than
  // midnight, which is always.
  const todayISO = now.toISOString().slice(0, 10);
  const due = new Date(nextDueDateISO + "T00:00:00");
  const today = new Date(todayISO + "T00:00:00");
  const days = Math.round((due.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
  return days >= 0 && days <= leadDays;
}

export { DEFAULT_EVENT_WINDOW_DAYS, DEFAULT_REMINDER_LEAD_DAYS };
