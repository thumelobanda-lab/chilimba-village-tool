/**
 * Web Push sending, using @block65/webcrypto-web-push — a Web Push
 * implementation built on the Web Crypto API, so it runs inside a
 * Cloudflare Worker (the original `web-push` npm package relies on
 * Node's crypto module and does not).
 *
 * VAPID keys: generate once with
 *   npx web-push generate-vapid-keys
 * Put the public key in wrangler.toml [vars] (it's meant to be public —
 * the frontend needs it too) and the private key via
 *   npx wrangler secret put VAPID_PRIVATE_KEY
 */
import { buildPushPayload } from "@block65/webcrypto-web-push";

export async function sendPush(env, subscription, message) {
  const vapid = {
    subject: env.VAPID_SUBJECT || "mailto:admin@example.com",
    publicKey: env.VAPID_PUBLIC_KEY,
    privateKey: env.VAPID_PRIVATE_KEY,
  };

  const payload = await buildPushPayload(
    { data: JSON.stringify(message) },
    {
      endpoint: subscription.endpoint,
      keys: { p256dh: subscription.p256dh, auth: subscription.auth },
    },
    vapid
  );

  const res = await fetch(subscription.endpoint, payload);

  // 404/410 means the browser subscription is gone (uninstalled, expired) —
  // caller should delete it so we stop retrying forever.
  return { ok: res.ok, status: res.status, expired: res.status === 404 || res.status === 410 };
}
