import { MOCK_MODE, realFetch } from "./core.js";

/**
 * The platform's support contact — read-only, unauthenticated, reachable
 * before any session exists (the sign-up screen and the Terms &
 * Conditions page both need it). Mirrors the same platform_settings
 * singleton the owner configures via lib/api/owner.js's getOwnerSettings
 * (requireOwner-gated there; this is the public read of the same two
 * fields — see worker/src/routes/publicContact.js). No mock-mode data
 * source exists for this, same reasoning as lib/api/messages.js: only a
 * real owner account can ever set it.
 */
export async function getSupportContact() {
  if (MOCK_MODE) return { supportEmail: null, supportWhatsapp: null };
  return realFetch("/api/support-contact");
}
