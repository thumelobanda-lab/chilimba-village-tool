import { maskPhone } from "../crypto.js";
import { MOCK_MODE, lsGet, lsSet, realFetch, currentSession, groupScopedKey } from "./core.js";

const SUBSCRIPTION_PRICE = 100; // K100
const SUBSCRIPTION_DAYS = 182; // ~6 months

export function subscriptionPrice() {
  return SUBSCRIPTION_PRICE;
}
export function subscriptionDurationDays() {
  return SUBSCRIPTION_DAYS;
}

// The subscription belongs to the GROUP now, not the individual member —
// one payment by an admin unlocks the app for everyone in the group for
// ~6 months. Any signed-in member can check status (that's what gates
// whether they see the app), but only an admin can actually pay — see
// initiateSubscriptionPayment below.
export async function getSubscriptionStatus() {
  const session = currentSession();
  if (!session) throw new Error("Not signed in.");
  if (MOCK_MODE) {
    const sub = lsGet(groupScopedKey(session, "group-sub"), null);
    if (!sub || !sub.expiresAt) return { active: false, status: "none", price: SUBSCRIPTION_PRICE, durationDays: SUBSCRIPTION_DAYS };
    const active = new Date(sub.expiresAt).getTime() > Date.now();
    return {
      active,
      status: active ? "active" : "expired",
      expiresAt: sub.expiresAt,
      price: SUBSCRIPTION_PRICE,
      durationDays: SUBSCRIPTION_DAYS,
    };
  }
  return realFetch("/api/subscription/group");
}

export async function initiateSubscriptionPayment({ phone, network }) {
  const session = currentSession();
  if (!session) throw new Error("Not signed in.");
  if (session.role !== "admin") throw new Error("Only a group admin can activate the subscription.");

  if (MOCK_MODE) {
    await new Promise((r) => setTimeout(r, 1200));
    const expiresAt = new Date(Date.now() + SUBSCRIPTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
    lsSet(groupScopedKey(session, "group-sub"), {
      maskedPhone: maskPhone(phone),
      network,
      amount: SUBSCRIPTION_PRICE,
      paidBy: session.name,
      paidAt: new Date().toISOString(),
      expiresAt,
      reference: `MOCK-${Date.now()}`,
    });
    return { status: "success", reference: `MOCK-${Date.now()}`, expiresAt };
  }

  return realFetch("/api/subscription/charge", {
    method: "POST",
    body: JSON.stringify({ phone, network }),
  });
}
