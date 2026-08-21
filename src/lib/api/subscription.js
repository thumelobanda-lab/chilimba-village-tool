import { maskPhone } from "../crypto.js";
import { MOCK_MODE, lsGet, lsSet, realFetch, currentSession, groupScopedKey } from "./core.js";

const SUBSCRIPTION_PRICE = 100; // K100
const SUBSCRIPTION_DAYS = 182; // ~6 months
export const FREE_TIER_MAX_MEMBERS = 8; // mirrors worker/src/subscriptionUtils.js

export function subscriptionPrice() {
  return SUBSCRIPTION_PRICE;
}
export function subscriptionDurationDays() {
  return SUBSCRIPTION_DAYS;
}

// The subscription belongs to the GROUP now, not the individual member —
// one CONFIRMED payment by a platform owner (never just an admin
// clicking "pay" — see initiateSubscriptionPayment below) unlocks
// premium features for everyone in the group for ~6 months. Every group
// without one is free tier: still usable, not blocked, just capped and
// missing premium features (see FreeTierBanner.jsx).
export async function getSubscriptionStatus() {
  const session = currentSession();
  if (!session) throw new Error("Not signed in.");
  if (MOCK_MODE) {
    const sub = lsGet(groupScopedKey(session, "group-sub"), null);
    const active = !!(sub?.expiresAt && new Date(sub.expiresAt).getTime() > Date.now());
    const prefix = `chilimba:account:${session.groupSlug}:`;
    let memberCount = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(prefix)) continue;
      const acc = lsGet(k, null);
      if (acc && acc.active !== false) memberCount++;
    }
    return {
      active,
      status: active ? "active" : "free",
      expiresAt: sub?.expiresAt || null,
      price: SUBSCRIPTION_PRICE,
      durationDays: SUBSCRIPTION_DAYS,
      freeTierMaxMembers: FREE_TIER_MAX_MEMBERS,
      memberCount,
      pending: sub?.status === "pending" ? { id: sub.reference, paidAt: sub.paidAt } : null,
    };
  }
  return realFetch("/api/subscription/group");
}

// Admin-only. Submits a payment CLAIM — it does NOT activate anything
// by itself. Mock mode mirrors the real backend's pending/confirm split
// (no more instant-activate-on-click, which is the exact leak this was
// fixed for — see routes/subscription.js): the claim is recorded as
// 'pending' and stays that way, since mock mode has no platform-owner
// backend to confirm it against. This is a deliberate scope limit, not
// an oversight — testing the confirm step needs a real deployed Worker
// + owner account, same as the reminder cron sweep has no mock
// equivalent either.
export async function initiateSubscriptionPayment({ phone, network }) {
  const session = currentSession();
  if (!session) throw new Error("Not signed in.");
  if (session.role !== "admin") throw new Error("Only a group admin can submit a payment.");

  if (MOCK_MODE) {
    await new Promise((r) => setTimeout(r, 800));
    const reference = `MOCK-PENDING-${Date.now()}`;
    lsSet(groupScopedKey(session, "group-sub"), {
      maskedPhone: maskPhone(phone),
      network,
      amount: SUBSCRIPTION_PRICE,
      paidBy: session.name,
      paidAt: new Date().toISOString(),
      status: "pending",
      expiresAt: null,
      reference,
    });
    return { status: "pending", reference };
  }

  return realFetch("/api/subscription/charge", {
    method: "POST",
    body: JSON.stringify({ phone, network }),
  });
}
