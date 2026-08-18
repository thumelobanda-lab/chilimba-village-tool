import { describe, it, expect } from "vitest";
import { selectReminderCandidates } from "./reminderSelection.js";

const schedule = [
  { id: "d1", date: "2026-06-20", group: "GROUP 1", payees: ["Doreen"], due: 1200 },
  { id: "d2", date: "2026-07-04", group: "GROUP 2", payees: ["Harriet"], due: 1200 },
];

function baseUser(overrides = {}) {
  return {
    id: "u1",
    name: "harriet",
    displayName: "Harriet",
    pushEnabled: true,
    smsEnabled: false,
    phone: null,
    leadDays: 2,
    ...overrides,
  };
}

// "today" is fixed two days before d1's due date, so d1 matches a
// leadDays: 2 preference exactly.
const today = new Date("2026-06-18T00:00:00Z");

describe("selectReminderCandidates", () => {
  it("selects a push candidate when leadDays matches the days until due", () => {
    const result = selectReminderCandidates({
      schedule,
      users: [baseUser()],
      dueOverrides: new Map(),
      alreadySent: new Set(),
      today,
      recipientExempt: true,
    });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ channel: "push", amount: 1200 });
    expect(result[0].row.id).toBe("d1");
  });

  it("does not select anything when leadDays doesn't match", () => {
    const result = selectReminderCandidates({
      schedule,
      users: [baseUser({ leadDays: 5 })],
      dueOverrides: new Map(),
      alreadySent: new Set(),
      today,
      recipientExempt: true,
    });
    expect(result).toHaveLength(0);
  });

  it("skips a date that's already in the past relative to today", () => {
    const pastToday = new Date("2026-08-01T00:00:00Z"); // after both schedule dates
    const result = selectReminderCandidates({
      schedule,
      users: [baseUser()],
      dueOverrides: new Map(),
      alreadySent: new Set(),
      today: pastToday,
      recipientExempt: true,
    });
    expect(result).toHaveLength(0);
  });

  it("skips the member's own payout date when recipients are exempt", () => {
    // d2 is Harriet's own date; put "today" 2 days before it instead
    const todayForD2 = new Date("2026-07-02T00:00:00Z");
    const result = selectReminderCandidates({
      schedule,
      users: [baseUser()],
      dueOverrides: new Map(),
      alreadySent: new Set(),
      today: todayForD2,
      recipientExempt: true,
    });
    expect(result).toHaveLength(0);
  });

  it("does not re-select a reminder that's already been sent", () => {
    const result = selectReminderCandidates({
      schedule,
      users: [baseUser()],
      dueOverrides: new Map(),
      alreadySent: new Set(["u1|d1|push"]),
      today,
      recipientExempt: true,
    });
    expect(result).toHaveLength(0);
  });

  it("uses the member's due override instead of the schedule default", () => {
    const result = selectReminderCandidates({
      schedule,
      users: [baseUser()],
      dueOverrides: new Map([["u1|d1", 900]]),
      alreadySent: new Set(),
      today,
      recipientExempt: true,
    });
    expect(result[0].amount).toBe(900);
  });

  it("selects both push and sms as separate candidates when both are enabled", () => {
    const result = selectReminderCandidates({
      schedule,
      users: [baseUser({ smsEnabled: true, phone: "0977123456" })],
      dueOverrides: new Map(),
      alreadySent: new Set(),
      today,
      recipientExempt: true,
    });
    const channels = result.map((r) => r.channel).sort();
    expect(channels).toEqual(["push", "sms"]);
  });

  it("does not select sms if enabled but no phone number is on file", () => {
    const result = selectReminderCandidates({
      schedule,
      users: [baseUser({ smsEnabled: true, phone: null })],
      dueOverrides: new Map(),
      alreadySent: new Set(),
      today,
      recipientExempt: true,
    });
    expect(result.every((r) => r.channel !== "sms")).toBe(true);
  });

  it("silently skips a schedule row with an unparseable date instead of throwing", () => {
    const badSchedule = [{ id: "bad", date: "not a date", group: "X", payees: [], due: 100 }];
    expect(() =>
      selectReminderCandidates({
        schedule: badSchedule,
        users: [baseUser()],
        dueOverrides: new Map(),
        alreadySent: new Set(),
        today,
        recipientExempt: true,
      })
    ).not.toThrow();
  });

  it("evaluates each user independently against the same schedule", () => {
    const result = selectReminderCandidates({
      schedule,
      users: [
        baseUser({ id: "u1", displayName: "Harriet", leadDays: 2 }),
        baseUser({ id: "u2", displayName: "Doreen", leadDays: 99 }), // won't match any date
      ],
      dueOverrides: new Map(),
      alreadySent: new Set(),
      today,
      recipientExempt: true,
    });
    expect(result).toHaveLength(1);
    expect(result[0].user.id).toBe("u1");
  });
});

describe("selectReminderCandidates — per-date overrides", () => {
  it("skips a (user, date) pair entirely when muted, even though the blanket setting would otherwise fire", () => {
    const result = selectReminderCandidates({
      schedule,
      users: [baseUser()], // leadDays: 2, today is exactly 2 days before d1
      dueOverrides: new Map(),
      dateOverrides: new Map([["u1|d1", { muted: true }]]),
      alreadySent: new Set(),
      today,
      recipientExempt: true,
    });
    expect(result).toHaveLength(0);
  });

  it("mutes only the specific date, not every date for that user", () => {
    const todayForD2 = new Date("2026-07-02T00:00:00Z"); // 2 days before d2
    const result = selectReminderCandidates({
      schedule,
      users: [baseUser({ displayName: "Fridah" })], // not the recipient of d2
      dueOverrides: new Map(),
      dateOverrides: new Map([["u1|d1", { muted: true }]]), // only d1 is muted
      alreadySent: new Set(),
      today: todayForD2,
      recipientExempt: true,
    });
    expect(result).toHaveLength(1);
    expect(result[0].row.id).toBe("d2");
  });

  it("uses a custom leadDays override instead of the user's blanket default", () => {
    // blanket default is 2, but override says 5 for this date — today
    // is 2 days out, so it should NOT fire under the override.
    const result = selectReminderCandidates({
      schedule,
      users: [baseUser()],
      dueOverrides: new Map(),
      dateOverrides: new Map([["u1|d1", { leadDays: 5 }]]),
      alreadySent: new Set(),
      today,
      recipientExempt: true,
    });
    expect(result).toHaveLength(0);
  });

  it("fires when today matches the custom override lead time, even if it doesn't match the blanket default", () => {
    const fiveDaysBefore = new Date("2026-06-15T00:00:00Z"); // 5 days before d1's June 20 due date
    const result = selectReminderCandidates({
      schedule,
      users: [baseUser()], // blanket leadDays is 2 — would NOT fire on its own here
      dueOverrides: new Map(),
      dateOverrides: new Map([["u1|d1", { leadDays: 5 }]]),
      alreadySent: new Set(),
      today: fiveDaysBefore,
      recipientExempt: true,
    });
    expect(result).toHaveLength(1);
    expect(result[0].row.id).toBe("d1");
  });

  it("falls back to the blanket default when no override exists for that date", () => {
    const result = selectReminderCandidates({
      schedule,
      users: [baseUser()],
      dueOverrides: new Map(),
      dateOverrides: new Map(), // no overrides at all
      alreadySent: new Set(),
      today,
      recipientExempt: true,
    });
    expect(result).toHaveLength(1);
  });

  it("defaults dateOverrides to an empty map when the caller doesn't pass one, preserving old behavior", () => {
    const result = selectReminderCandidates({
      schedule,
      users: [baseUser()],
      dueOverrides: new Map(),
      alreadySent: new Set(),
      today,
      recipientExempt: true,
    });
    expect(result).toHaveLength(1);
  });
});
