import { maskPhone } from "../crypto.js";
import { MOCK_MODE, lsGet, lsSet, realFetch, currentSession, groupScopedKey } from "./core.js";

const SUBSCRIPTION_PRICE = 25; // K25 per cycle
const CYCLE_DAYS = 90;

export function subscriptionPrice() {
  return SUBSCRIPTION_PRICE;
}

export async function getSubscriptionStatus() {
  const session = currentSession();
  if (!session) throw new Error("Not signed in.");
  if (MOCK_MODE) {
    const sub = lsGet(groupScopedKey(session, "sub", session.name.toLowerCase()), null);
    if (!sub) return { active: false, status: "none" };
    const active = new Date(sub.expiresAt).getTime() > Date.now();
    return { active, status: active ? "active" : "expired", expiresAt: sub.expiresAt, maskedPhone: sub.maskedPhone };
  }
  return realFetch("/api/subscription/me");
}

export async function initiateSubscriptionPayment({ phone, network }) {
  const session = currentSession();
  if (!session) throw new Error("Not signed in.");

  if (MOCK_MODE) {
    await new Promise((r) => setTimeout(r, 1200));
    const expiresAt = new Date(Date.now() + CYCLE_DAYS * 24 * 60 * 60 * 1000).toISOString();
    lsSet(groupScopedKey(session, "sub", session.name.toLowerCase()), {
      maskedPhone: maskPhone(phone),
      network,
      amount: SUBSCRIPTION_PRICE,
      paidAt: new Date().toISOString(),
      expiresAt,
      reference: `MOCK-${Date.now()}`,
    });
    return { status: "success", reference: `MOCK-${Date.now()}` };
  }

  return realFetch("/api/subscription/charge", {
    method: "POST",
    body: JSON.stringify({ phone, network, amount: SUBSCRIPTION_PRICE }),
  });
}
