/**
 * Pre-written starter text behind the owner-messaging compose screen's
 * category picker (OwnerMessaging.jsx) — kept as plain data plus one
 * small pure substitution function, dependency-free and colocated with
 * a test file, same discipline as inviteCard.js. Every template is
 * meant to be edited before sending, not sent verbatim: bracketed
 * placeholders like [Reason] or [Amount] are left as literal text for
 * the owner to fill in by hand; only [Group Name] and [Date] are
 * substituted automatically here, since those are the two the compose
 * screen already knows at the moment a template is inserted.
 *
 * Tone is deliberately calm and non-accusatory even for the serious
 * categories (fraud, suspension) — these notices reach a group's real
 * admins and members, often people managing real community trust and
 * real money; "we noticed X, here's what happens next" reads very
 * differently from an accusation, and that difference matters here.
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
      "If anything looks unfamiliar, please reply to this message or contact us right away so we can look into it together.",
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
      "If nothing changes, we may need to limit or suspend this group's access — we'd much rather resolve it together first.",
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
      "You can submit payment anytime from the Subscription tab — thank you for keeping your Chilimba running smoothly.",
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
      "To appeal or resolve this, please reply to this message or contact us directly with any information that could help. We're glad to review it.",
  },
  {
    id: "general_announcement",
    label: "General Announcement",
    icon: "📣",
    tagColor: "general",
    template:
      "Hi [Group Name] — we wanted to let you know: [Announcement details].\n\n" +
      "If you have any questions, feel free to reach out. Thank you for being part of Chilimba Circle!",
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
      "Thank you for your patience.",
  },
];

export function getMessageCategory(id) {
  return MESSAGE_CATEGORIES.find((c) => c.id === id) || null;
}

/**
 * Fills in [Group Name] and [Date] wherever they appear in a template —
 * every other bracketed placeholder ([Reason], [Amount], ...) is left
 * exactly as-is for the owner to replace by hand before sending.
 *
 * @param {string} template
 * @param {{ groupName?: string, dateLabel?: string }} values
 * @returns {string}
 */
export function applyTemplatePlaceholders(template, { groupName, dateLabel } = {}) {
  let result = template;
  if (groupName) result = result.split("[Group Name]").join(groupName);
  if (dateLabel) result = result.split("[Date]").join(dateLabel);
  return result;
}
