import { isRecipient, resolveDue } from "./scheduleUtils.js";

/**
 * Decides which (user, date, channel) reminders should fire right now.
 * Pure — no DB, no network — so the actual selection logic can be tested
 * directly (see reminderSelection.test.js) instead of only through a live
 * cron run. The caller (runReminderSweep in reminders.js) is responsible
 * for fetching the inputs in bulk and performing the sends/writes for
 * whatever this returns.
 *
 * @param {object} params
 * @param {Array} params.schedule - group_config's schedule rows
 * @param {Array} params.users - [{id, name, displayName, pushEnabled, smsEnabled, phone, leadDays}]
 * @param {Map<string, number>} params.dueOverrides - key `${userId}|${scheduleRowId}` -> amount
 * @param {Map<string, {leadDays?: number, muted?: boolean}>} [params.dateOverrides] - key
 *   `${userId}|${scheduleRowId}` -> per-date reminder override. `muted: true` skips this
 *   (user, date) entirely regardless of the blanket setting; `leadDays` replaces the
 *   user's default lead time for just this date. Defaults to an empty map, so every
 *   existing caller that doesn't pass this keeps the old blanket-only behavior unchanged.
 * @param {Set<string>} params.alreadySent - key `${userId}|${scheduleRowId}|${channel}`
 * @param {Date} params.today - start-of-day reference point (UTC)
 * @param {boolean} params.recipientExempt
 * @returns {Array<{ user, row, amount, channel: 'push'|'sms' }>}
 */
export function selectReminderCandidates({ schedule, users, dueOverrides, dateOverrides = new Map(), alreadySent, today, recipientExempt }) {
  const candidates = [];

  for (const row of schedule) {
    const dueDate = new Date(row.date);
    if (isNaN(dueDate.getTime())) continue;
    const daysUntil = Math.round((dueDate - today) / (24 * 60 * 60 * 1000));
    if (daysUntil < 0) continue;

    for (const user of users) {
      const dateOverride = dateOverrides.get(`${user.id}|${row.id}`);
      if (dateOverride?.muted) continue; // explicitly opted out of reminders for this one date

      const effectiveLeadDays = dateOverride?.leadDays ?? user.leadDays ?? 2;
      if (daysUntil !== effectiveLeadDays) continue;
      if (isRecipient(row, user.displayName, recipientExempt)) continue; // nothing owed on their own payout date

      const overrideAmount = dueOverrides.get(`${user.id}|${row.id}`);
      const amount = resolveDue(row, user.displayName, recipientExempt, overrideAmount);
      if (!amount || amount <= 0) continue;

      if (user.pushEnabled && !alreadySent.has(`${user.id}|${row.id}|push`)) {
        candidates.push({ user, row, amount, channel: "push" });
      }
      if (user.smsEnabled && user.phone && !alreadySent.has(`${user.id}|${row.id}|sms`)) {
        candidates.push({ user, row, amount, channel: "sms" });
      }
    }
  }

  return candidates;
}
