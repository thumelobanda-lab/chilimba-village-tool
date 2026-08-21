/**
 * Pure logic behind the platform owner's direct-messaging feature —
 * kept dependency-free and colocated with a test file (same discipline
 * as communityFundSplit.js/fundCrediting.js) so the target-label wording
 * and validation rules are verified without touching D1.
 */

export const MAX_MESSAGE_LENGTH = 1000;

export const TARGET_TYPES = ["user", "group_admins", "group_members"];

export function isValidTargetType(targetType) {
  return TARGET_TYPES.includes(targetType);
}

/**
 * A stable, human-readable snapshot of who a message was sent to, stored
 * on the owner_messages row itself (not recomputed via a join) so the
 * owner's log stays readable even if the group is renamed or the
 * individual recipient is later removed.
 *
 * @param {{ targetType: string, groupName: string, userDisplayName?: string }} params
 * @returns {string}
 */
export function buildTargetLabel({ targetType, groupName, userDisplayName }) {
  if (targetType === "user") return `${userDisplayName} (${groupName})`;
  if (targetType === "group_admins") return `All admins — ${groupName}`;
  if (targetType === "group_members") return `All members — ${groupName}`;
  throw new Error(`Unknown targetType: ${targetType}`);
}

/**
 * Trims and length-checks a message body. Returns the trimmed message,
 * or throws a plain Error with a user-facing reason — the caller (the
 * route handler) is responsible for translating that into an HttpError,
 * same separation communityFundSplit.js keeps from HttpError.
 *
 * @param {string} message
 * @returns {string}
 */
export function validateMessageBody(message) {
  const trimmed = (message || "").trim();
  if (!trimmed) throw new Error("A message is required.");
  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    throw new Error(`Keep messages under ${MAX_MESSAGE_LENGTH} characters.`);
  }
  return trimmed;
}
