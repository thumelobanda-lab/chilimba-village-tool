/**
 * Pure text-building logic for the group invite — separated from the
 * actual canvas drawing in InviteCard.jsx because canvas isn't available
 * in this project's test environment (no jsdom/canvas polyfill; see the
 * note in Walkthrough.test.js). This half is what's actually worth
 * testing: the wording and structure, not the pixel rendering.
 */

export function buildInviteMessage({ groupName, groupSlug, appUrl }) {
  if (!groupName || !groupSlug || !appUrl) {
    throw new Error("groupName, groupSlug, and appUrl are all required.");
  }
  return (
    `Join our savings circle, ${groupName}! 🤝\n\n` +
    `See everyone's contributions, get reminders, no more paper books.\n\n` +
    `Group code: ${groupSlug}\n` +
    `Sign in here: ${appUrl}`
  );
}

export function buildWhatsAppShareUrl(message) {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

export function buildInviteCardFilename(groupSlug) {
  const safe = (groupSlug || "group").replace(/[^a-z0-9-]/gi, "-").toLowerCase();
  return `chilimba-invite-${safe}.png`;
}

/**
 * Layout data for the canvas card — kept as plain data (not drawing
 * calls) so the content itself (what text goes where, in what order) is
 * something a test can assert on without a canvas.
 */
export function buildCardContent({ groupName, groupSlug, cycleName, appUrl }) {
  return {
    brand: "Chilimba Village Tool",
    groupName: groupName || "Your Chilimba",
    cycleLabel: cycleName ? `${cycleName}` : null,
    codeLabel: "GROUP CODE",
    code: groupSlug || "",
    tagline: "Everyone sees the same book. No more paper, no more guessing.",
    url: appUrl || "",
  };
}
