/**
 * Pure validation behind the platform-wide support contact (migration
 * 012) — kept dependency-free and colocated with a test file, same
 * discipline as ownerMessages.js. Deliberately lenient: this is an
 * internal owner-configured value (not user-submitted data needing
 * strict format enforcement), so it's a length/non-emptiness check, not
 * an email-format regex that would just be a source of false rejections
 * for a value only ever shown to members as plain text.
 */

export const MAX_CONTACT_FIELD_LENGTH = 200;

/**
 * @param {{ supportEmail?: string, supportWhatsapp?: string }} input
 * @returns {{ supportEmail: string|null, supportWhatsapp: string|null }}
 */
export function validateSupportContact({ supportEmail, supportWhatsapp } = {}) {
  const email = (supportEmail || "").trim();
  const whatsapp = (supportWhatsapp || "").trim();
  if (email.length > MAX_CONTACT_FIELD_LENGTH || whatsapp.length > MAX_CONTACT_FIELD_LENGTH) {
    throw new Error(`Keep each contact field under ${MAX_CONTACT_FIELD_LENGTH} characters.`);
  }
  return { supportEmail: email || null, supportWhatsapp: whatsapp || null };
}
