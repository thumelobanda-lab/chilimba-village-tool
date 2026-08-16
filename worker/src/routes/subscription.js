import { requireSession } from "../auth.js";
import { maskPhone, uid } from "../crypto.js";
import { json } from "../responses.js";

export default function registerSubscriptionRoutes(router) {
  router.get("/api/subscription/me", async ({ request, env, cors }) => {
    const user = await requireSession(request, env);
    const sub = await env.DB.prepare(
      `SELECT masked_phone as maskedPhone, expires_at as expiresAt FROM subscriptions WHERE user_id = ?`
    ).bind(user.id).first();
    if (!sub) return json({ active: false, status: "none" }, 200, cors);
    const active = new Date(sub.expiresAt).getTime() > Date.now();
    return json({ active, status: active ? "active" : "expired", ...sub }, 200, cors);
  });

  router.post("/api/subscription/charge", async ({ request, env, cors }) => {
    const user = await requireSession(request, env);
    const body = await request.json();

    // --- Plug in your real mobile money aggregator here ---
    // e.g. call Flutterwave/Paychangu's charge endpoint using
    // env.MOMO_API_KEY (a Worker secret, never in source). The call
    // below is a placeholder that always succeeds — replace it before
    // handling real payments.
    const reference = `PENDING-${uid()}`;
    // const chargeResult = await fetch("https://api.yourprovider.com/charge", {
    //   method: "POST",
    //   headers: { Authorization: `Bearer ${env.MOMO_API_KEY}` },
    //   body: JSON.stringify({ phone: body.phone, amount: body.amount, network: body.network }),
    // }).then(r => r.json());

    const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
    await env.DB.prepare(
      `INSERT INTO subscriptions (user_id, group_id, masked_phone, network, amount, reference, paid_at, expires_at)
       VALUES (?,?,?,?,?,?,datetime('now'),?)
       ON CONFLICT(user_id) DO UPDATE SET masked_phone=excluded.masked_phone, network=excluded.network,
         amount=excluded.amount, reference=excluded.reference, paid_at=excluded.paid_at, expires_at=excluded.expires_at`
    ).bind(user.id, user.groupId, maskPhone(body.phone), body.network, body.amount, reference, expiresAt).run();

    return json({ status: "success", reference }, 200, cors);
  });
}
