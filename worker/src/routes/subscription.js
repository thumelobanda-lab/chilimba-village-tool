import { requireSession, requireAdmin } from "../auth.js";
import { HttpError } from "../httpError.js";
import { maskPhone, uid } from "../crypto.js";
import { json } from "../responses.js";
import { isSubscriptionActive, computeExpiryDate, subscriptionPrice, subscriptionDurationDays } from "../subscriptionUtils.js";

export default function registerSubscriptionRoutes(router) {
  // Any signed-in member of the group can check its subscription status —
  // this is what gates whether they see the app at all — but only an
  // admin can see the payment form. requireSession (not requireAdmin) is
  // correct here on purpose.
  router.get("/api/subscription/group", async ({ request, env, cors }) => {
    const user = await requireSession(request, env);
    const group = await env.DB.prepare(`SELECT subscription_expires_at FROM groups WHERE id = ?`)
      .bind(user.groupId).first();
    const active = isSubscriptionActive(group?.subscription_expires_at);
    return json({
      active,
      status: active ? "active" : "expired",
      expiresAt: group?.subscription_expires_at || null,
      price: subscriptionPrice(),
      durationDays: subscriptionDurationDays(),
    }, 200, cors);
  });

  // Admin-only. K100 activates the WHOLE group for ~6 months — regular
  // members never see this endpoint's form, and the check here is
  // server-side, not just a hidden button in the UI.
  router.post("/api/subscription/charge", async ({ request, env, cors }) => {
    const admin = await requireAdmin(request, env);
    const body = await request.json();
    if (!body.phone || !body.network) throw new HttpError(400, "phone and network are required.");

    // --- Plug in your real mobile money aggregator here ---
    // e.g. call Flutterwave/Paychangu's charge endpoint using
    // env.MOMO_API_KEY (a Worker secret, never in source). The call
    // below is a placeholder that always succeeds — replace it before
    // handling real payments.
    const reference = `PENDING-${uid()}`;
    // const chargeResult = await fetch("https://api.yourprovider.com/charge", {
    //   method: "POST",
    //   headers: { Authorization: `Bearer ${env.MOMO_API_KEY}` },
    //   body: JSON.stringify({ phone: body.phone, amount: subscriptionPrice(), network: body.network }),
    // }).then(r => r.json());

    const expiresAt = computeExpiryDate().toISOString();
    const id = uid();

    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO group_subscriptions (id, group_id, paid_by, masked_phone, network, amount, reference, paid_at, expires_at)
         VALUES (?,?,?,?,?,?,?,datetime('now'),?)`
      ).bind(id, admin.groupId, admin.name, maskPhone(body.phone), body.network, subscriptionPrice(), reference, expiresAt),
      env.DB.prepare(`UPDATE groups SET subscription_expires_at = ? WHERE id = ?`)
        .bind(expiresAt, admin.groupId),
    ]);

    return json({ status: "success", reference, expiresAt }, 200, cors);
  });
}
