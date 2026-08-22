import { json } from "../responses.js";

/**
 * The platform's support contact (email/WhatsApp) — deliberately
 * unauthenticated. This is the same platform_settings singleton row the
 * owner configures via GET/PUT /api/owner/settings (requireOwner-gated,
 * see routes/owner.js), but reading just the contact info here has to be
 * reachable by someone who has no session yet at all: the sign-up
 * checkbox flow and the Terms & Conditions page both need it before a
 * account — or any session — exists yet. Nothing sensitive lives in this
 * table beyond the two contact fields, so exposing read-only access to
 * them is the same trust level as printing them on a public website.
 */
export default function registerPublicContactRoutes(router) {
  router.get("/api/support-contact", async ({ env, cors }) => {
    const row = await env.DB.prepare(
      `SELECT support_email as supportEmail, support_whatsapp as supportWhatsapp FROM platform_settings WHERE id = 'default'`
    ).first();
    return json(row || { supportEmail: null, supportWhatsapp: null }, 200, cors);
  });
}
