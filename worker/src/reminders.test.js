import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./push.js", () => ({ sendPush: vi.fn().mockResolvedValue({ ok: true, expired: false }) }));
vi.mock("./sms.js", () => ({ sendSms: vi.fn().mockResolvedValue({ ok: true }) }));

import { runReminderSweep } from "./reminders.js";
import { sendPush } from "./push.js";

/**
 * A minimal fake D1 covering multiple groups, each with its own schedule,
 * members, overrides, sent-log, and push subscriptions — keyed by
 * group_id so a query that forgets a WHERE group_id = ? clause would
 * show up immediately as cross-group data leaking into results.
 */
function makeFakeD1({ groups, usersByGroup, overridesByGroup, sentByGroup, subsByGroup, dateOverridesByGroup = {} }) {
  let roundTrips = 0;
  const batchCallsByStatementCount = [];

  const DB = {
    prepare(sql) {
      return {
        _bound: [],
        bind(...args) {
          this._bound = args;
          return this;
        },
        async first() {
          roundTrips++;
          return null;
        },
        async all() {
          roundTrips++;
          if (sql.includes("FROM groups")) return { results: groups };
          if (sql.includes("FROM users u JOIN reminder_prefs")) {
            const groupId = this._bound[0];
            return { results: usersByGroup[groupId] || [] };
          }
          if (sql.includes("FROM due_overrides")) {
            const groupId = this._bound[0];
            return { results: overridesByGroup[groupId] || [] };
          }
          if (sql.includes("FROM reminder_log")) {
            const groupId = this._bound[0];
            return { results: sentByGroup[groupId] || [] };
          }
          if (sql.includes("FROM push_subscriptions")) {
            const groupId = this._bound[0];
            return { results: subsByGroup[groupId] || [] };
          }
          if (sql.includes("FROM reminder_date_overrides")) {
            const groupId = this._bound[0];
            return { results: dateOverridesByGroup[groupId] || [] };
          }
          return { results: [] };
        },
        async run() {
          roundTrips++;
          return { success: true };
        },
      };
    },
    async batch(statements) {
      roundTrips++;
      batchCallsByStatementCount.push(statements.length);
      return statements.map(() => ({ success: true }));
    },
  };

  return { DB, getRoundTrips: () => roundTrips, getBatchCalls: () => batchCallsByStatementCount };
}

function dueDateTwoDaysOut() {
  const d = new Date();
  d.setDate(d.getDate() + 2);
  return d.toISOString().slice(0, 10);
}

// Automated reminders are premium-only (see subscriptionUtils.js) — every
// group fixture in this file needs an active subscription so these tests
// keep exercising reminder-selection behavior, not the tier gate itself
// (that gate has its own dedicated test below).
function activeSubExpiry() {
  const d = new Date();
  d.setDate(d.getDate() + 60);
  return d.toISOString();
}

function makeUser(id, overrides = {}) {
  return {
    id, name: id, displayName: id, pushEnabled: 1, smsEnabled: 0, phone: null, leadDays: 2,
    ...overrides,
  };
}

describe("runReminderSweep (multi-tenant)", () => {
  beforeEach(() => vi.clearAllMocks());

  const dueDate = dueDateTwoDaysOut();

  it("runs an independent sweep per group and never mixes one group's members into another's", async () => {
    const groups = [
      { id: "group-a", schedule_json: JSON.stringify([{ id: "d1", date: dueDate, group: "G1", payees: ["nobody"], due: 1000 }]), funds_json: "[]", recipient_exempt: 1, subscription_expires_at: activeSubExpiry() },
      { id: "group-b", schedule_json: JSON.stringify([{ id: "d1", date: dueDate, group: "G1", payees: ["nobody"], due: 500 }]), funds_json: "[]", recipient_exempt: 1, subscription_expires_at: activeSubExpiry() },
    ];
    const fake = makeFakeD1({
      groups,
      usersByGroup: {
        "group-a": [makeUser("alice")],
        "group-b": [makeUser("bob")],
      },
      overridesByGroup: {},
      sentByGroup: {},
      subsByGroup: {},
    });

    await runReminderSweep({ DB: fake.DB });

    // one batch write per group (each group has exactly one candidate to log)
    expect(fake.getBatchCalls()).toEqual([1, 1]);
  });

  it("scopes every per-group query by that group's id, not the previous group's", async () => {
    const groups = [
      { id: "group-a", schedule_json: JSON.stringify([{ id: "d1", date: dueDate, group: "G1", payees: [], due: 1000 }]), funds_json: "[]", recipient_exempt: 1, subscription_expires_at: activeSubExpiry() },
      { id: "group-b", schedule_json: JSON.stringify([{ id: "d1", date: dueDate, group: "G1", payees: [], due: 500 }]), funds_json: "[]", recipient_exempt: 1, subscription_expires_at: activeSubExpiry() },
    ];
    const fake = makeFakeD1({
      groups,
      usersByGroup: {
        "group-a": [makeUser("alice")],
        "group-b": [], // no reminder-enabled members in group-b at all
      },
      overridesByGroup: {},
      sentByGroup: {},
      subsByGroup: {},
    });

    await runReminderSweep({ DB: fake.DB });

    // group-a has 1 candidate to log, group-b has 0 users so it returns
    // early with no batch call at all for that group.
    expect(fake.getBatchCalls()).toEqual([1]);
  });

  it("makes a fixed number of round trips per group regardless of how many members it has", async () => {
    const oneGroupSmall = [{ id: "g", schedule_json: JSON.stringify([{ id: "d1", date: dueDate, group: "G1", payees: [], due: 1000 }]), funds_json: "[]", recipient_exempt: 1, subscription_expires_at: activeSubExpiry() }];
    const small = makeFakeD1({
      groups: oneGroupSmall,
      usersByGroup: { g: [makeUser("a")] },
      overridesByGroup: {}, sentByGroup: {}, subsByGroup: {},
    });
    const large = makeFakeD1({
      groups: oneGroupSmall,
      usersByGroup: { g: Array.from({ length: 20 }, (_, i) => makeUser(`m${i}`)) },
      overridesByGroup: {}, sentByGroup: {}, subsByGroup: {},
    });

    await runReminderSweep({ DB: small.DB });
    await runReminderSweep({ DB: large.DB });

    // 1 (groups) + 5 (Promise.all: users, overrides, sent, subs, date-overrides)
    // + 1 (batch) = 7, whether the group has 1 member or 20.
    expect(small.getRoundTrips()).toBe(7);
    expect(large.getRoundTrips()).toBe(7);
  });

  it("skips a date entirely for a member who has muted it, even though it would otherwise fire", () => {
    const groups = [{ id: "g", schedule_json: JSON.stringify([{ id: "d1", date: dueDate, group: "G1", payees: [], due: 1000 }]), funds_json: "[]", recipient_exempt: 1, subscription_expires_at: activeSubExpiry() }];
    const fake = makeFakeD1({
      groups,
      usersByGroup: { g: [makeUser("alice")] },
      overridesByGroup: {}, sentByGroup: {}, subsByGroup: {},
      dateOverridesByGroup: { g: [{ user_id: "alice", schedule_row_id: "d1", lead_days: null, muted: 1 }] },
    });

    return runReminderSweep({ DB: fake.DB }).then(() => {
      expect(sendPush).not.toHaveBeenCalled();
      expect(fake.getBatchCalls()).toEqual([]); // nothing to log, since nothing fired
    });
  });

  it("uses a member's custom lead time for one date instead of their blanket default", () => {
    // alice's blanket default is 2 days (see makeUser); the date is 2
    // days out, so WITHOUT an override it would fire. A custom
    // leadDays of 5 for this specific date means it should NOT fire
    // today, since 2 !== 5.
    const groups = [{ id: "g", schedule_json: JSON.stringify([{ id: "d1", date: dueDate, group: "G1", payees: [], due: 1000 }]), funds_json: "[]", recipient_exempt: 1, subscription_expires_at: activeSubExpiry() }];
    const fake = makeFakeD1({
      groups,
      usersByGroup: { g: [makeUser("alice")] },
      overridesByGroup: {}, sentByGroup: {}, subsByGroup: {},
      dateOverridesByGroup: { g: [{ user_id: "alice", schedule_row_id: "d1", lead_days: 5, muted: 0 }] },
    });

    return runReminderSweep({ DB: fake.DB }).then(() => {
      expect(sendPush).not.toHaveBeenCalled();
    });
  });

  it("skips a group entirely when its schedule is empty, without erroring", async () => {
    const groups = [{ id: "empty-group", schedule_json: "[]", funds_json: "[]", recipient_exempt: 1, subscription_expires_at: activeSubExpiry() }];
    const fake = makeFakeD1({ groups, usersByGroup: {}, overridesByGroup: {}, sentByGroup: {}, subsByGroup: {} });

    await expect(runReminderSweep({ DB: fake.DB })).resolves.not.toThrow();
    expect(fake.getBatchCalls()).toEqual([]);
  });

  it("skips a free-tier group entirely — automated reminders are premium-only", async () => {
    const groups = [
      { id: "free-group", schedule_json: JSON.stringify([{ id: "d1", date: dueDate, group: "G1", payees: [], due: 1000 }]), funds_json: "[]", recipient_exempt: 1, subscription_expires_at: null },
    ];
    const fake = makeFakeD1({ groups, usersByGroup: { "free-group": [makeUser("alice")] }, overridesByGroup: {}, sentByGroup: {}, subsByGroup: {} });

    await runReminderSweep({ DB: fake.DB });
    expect(sendPush).not.toHaveBeenCalled();
    expect(fake.getBatchCalls()).toEqual([]);
  });

  it("skips a suspended group entirely, even with an active subscription", async () => {
    const groups = [
      {
        id: "suspended-group",
        schedule_json: JSON.stringify([{ id: "d1", date: dueDate, group: "G1", payees: [], due: 1000 }]),
        funds_json: "[]",
        recipient_exempt: 1,
        subscription_expires_at: activeSubExpiry(),
        suspended_at: "2026-08-01T00:00:00Z",
      },
    ];
    const fake = makeFakeD1({ groups, usersByGroup: { "suspended-group": [makeUser("alice")] }, overridesByGroup: {}, sentByGroup: {}, subsByGroup: {} });

    await runReminderSweep({ DB: fake.DB });
    expect(sendPush).not.toHaveBeenCalled();
  });

  it("does nothing at all when there are no groups", async () => {
    const fake = makeFakeD1({ groups: [], usersByGroup: {}, overridesByGroup: {}, sentByGroup: {}, subsByGroup: {} });
    await runReminderSweep({ DB: fake.DB });
    expect(fake.getBatchCalls()).toEqual([]);
    expect(sendPush).not.toHaveBeenCalled();
  });
});
