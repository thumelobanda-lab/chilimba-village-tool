/**
 * Pre-written starter text behind the owner-messaging compose screen's
 * category picker (OwnerMessaging.jsx) — kept as plain data plus small
 * pure substitution functions, dependency-free and colocated with a
 * test file, same discipline as inviteCard.js. Every template is meant
 * to be edited before sending, not sent verbatim: bracketed placeholders
 * like [Reason] or [Amount] are left as literal text for the owner to
 * fill in by hand; [Group Name], [Date], and [Contact] are substituted
 * automatically, since those are the ones the compose screen already
 * knows at the moment a template is inserted ([Contact] from the
 * owner-configured platform support contact, GET /api/owner/settings —
 * see buildContactLabel below).
 *
 * Every template ends with a category-appropriate next step, not just a
 * statement of the problem — for fraud_warning and account_suspended in
 * particular this is a real appeal/resolution path, not a vague "we'll
 * be in touch". Tone is deliberately calm and non-accusatory even for
 * those two — these notices reach a group's real admins and members,
 * often people managing real community trust and real money; "we
 * noticed X, here's how to resolve it" reads very differently from an
 * accusation, and that difference matters here.
 *
 * tagColor is a key into the .category-tag-<tagColor> classes in
 * styles.css — the distinct-color-per-category the sent-messages log
 * scans by at a glance.
 */
export const MESSAGE_CATEGORIES = [
  {
    id: "fraud_warning",
    label: "Fraud Warning",
    icon: "🚩",
    tagColor: "fraud",
    template:
      "We've noticed unusual activity connected to [Group Name] that doesn't match its usual pattern. " +
      "This is a precaution, not an accusation — please take a moment to review recent transactions and " +
      "confirm everything looks correct.\n\n" +
      "What we flagged: [Reason]\n" +
      "When: [Date]\n\n" +
      "If anything looks unfamiliar, please contact us at [Contact] right away so we can look into it together.",
  },
  {
    id: "spam_abuse",
    label: "Spam/Abuse Notice",
    icon: "⚠️",
    tagColor: "warning",
    template:
      "We wanted to flag some activity on [Group Name] that appears to go against Chilimba Circle's platform terms: [Reason].\n\n" +
      "We're reaching out directly before taking any further action, in case there's a simple explanation. " +
      "Please review our terms and address this by [Date].\n\n" +
      "If nothing changes, we may need to limit or suspend this group's access. To discuss this or share more " +
      "context, contact us at [Contact] — we'd much rather resolve it together first.",
  },
  {
    id: "subscription_reminder",
    label: "Subscription Reminder",
    icon: "💳",
    tagColor: "billing",
    template:
      "This is a reminder that [Group Name]'s subscription is due for renewal as of [Date].\n\n" +
      "Amount due: [Amount]\n\n" +
      "Renewing keeps receipts, automated reminders, and community fund splitting active for every member of your group. " +
      "You can submit payment anytime from the Subscription tab.\n\n" +
      "Questions about your payment or subscription? Reach us at [Contact].",
  },
  {
    id: "account_suspended",
    label: "Account Suspended",
    icon: "🚫",
    tagColor: "suspended",
    template:
      "[Group Name] has been suspended as of [Date].\n\n" +
      "Reason: [Reason]\n\n" +
      "What this means: members of this group can't sign in until the suspension is lifted. No data has been " +
      "deleted — everything will be restored in full once this is resolved.\n\n" +
      "To appeal or resolve this, contact us at [Contact] with any information that could help. We review every appeal and will respond as soon as we can.",
  },
  {
    id: "general_announcement",
    label: "General Announcement",
    icon: "📣",
    tagColor: "general",
    template:
      "Hi [Group Name] — we wanted to let you know: [Announcement details].\n\n" +
      "If you have any questions, reach out to us at [Contact]. Thank you for being part of Chilimba Circle!",
  },
  {
    id: "payment_dispute",
    label: "Payment Dispute/Investigation",
    icon: "🔍",
    tagColor: "review",
    template:
      "We're currently reviewing a payment or complaint connected to [Group Name]: [Reason].\n\n" +
      "No action is needed from you at this stage — we just wanted to keep you informed while we look into it. " +
      "We'll follow up by [Date] with an update or resolution.\n\n" +
      "If you have questions in the meantime, contact us at [Contact]. Thank you for your patience.",
  },
];

export function getMessageCategory(id) {
  return MESSAGE_CATEGORIES.find((c) => c.id === id) || null;
}

/**
 * Turns the owner-configured support contact into the single string
 * [Contact] resolves to — "support@x.com", "WhatsApp +260...", or both
 * joined with "or" if the owner set both. Empty string (not one of the
 * fields set) if neither is configured, which applyTemplatePlaceholders
 * below treats as "leave [Contact] as a literal placeholder" — the same
 * "nothing to substitute yet" behavior [Group Name] already has before a
 * group is picked, rather than silently sending a template that reads
 * "contact us at [Contact]" verbatim.
 *
 * @param {{ supportEmail?: string|null, supportWhatsapp?: string|null }} settings
 * @returns {string}
 */
export function buildContactLabel({ supportEmail, supportWhatsapp } = {}) {
  const parts = [];
  if (supportEmail) parts.push(supportEmail);
  if (supportWhatsapp) parts.push(`WhatsApp ${supportWhatsapp}`);
  return parts.join(" or ");
}

/**
 * Fills in [Group Name], [Date], and [Contact] wherever they appear in a
 * template — every other bracketed placeholder ([Reason], [Amount], ...)
 * is left exactly as-is for the owner to replace by hand before sending.
 *
 * @param {string} template
 * @param {{ groupName?: string, dateLabel?: string, contactLabel?: string }} values
 * @returns {string}
 */
export function applyTemplatePlaceholders(template, { groupName, dateLabel, contactLabel } = {}) {
  let result = template;
  if (groupName) result = result.split("[Group Name]").join(groupName);
  if (dateLabel) result = result.split("[Date]").join(dateLabel);
  if (contactLabel) result = result.split("[Contact]").join(contactLabel);
  return result;
}
