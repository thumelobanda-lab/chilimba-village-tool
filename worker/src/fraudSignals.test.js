import { describe, it, expect } from "vitest";
import { detectSharedSignalFraud } from "./fraudSignals.js";

function group(overrides) {
  return { id: "g1", groupName: "Group", createdAt: "2026-08-20T00:00:00Z", createdIp: null, createdByPhone: null, ...overrides };
}

describe("detectSharedSignalFraud", () => {
  it("flags no signal when there's only one group", () => {
    const groups = [group({ id: "a", createdIp: "1.2.3.4" })];
    expect(detectSharedSignalFraud(groups)).toEqual([]);
  });

  it("flags two groups sharing an IP within the window", () => {
    const groups = [
      group({ id: "a", groupName: "A", createdIp: "1.2.3.4", createdAt: "2026-08-20T00:00:00Z" }),
      group({ id: "b", groupName: "B", createdIp: "1.2.3.4", createdAt: "2026-08-20T02:00:00Z" }),
    ];
    const signals = detectSharedSignalFraud(groups, 48);
    expect(signals).toHaveLength(1);
    expect(signals[0]).toEqual({
      type: "ip",
      value: "1.2.3.4",
      groups: [
        { id: "a", groupName: "A", createdAt: "2026-08-20T00:00:00Z" },
        { id: "b", groupName: "B", createdAt: "2026-08-20T02:00:00Z" },
      ],
    });
  });

  it("does not flag groups sharing an IP far outside the window", () => {
    const groups = [
      group({ id: "a", createdIp: "1.2.3.4", createdAt: "2026-01-01T00:00:00Z" }),
      group({ id: "b", createdIp: "1.2.3.4", createdAt: "2026-08-20T00:00:00Z" }),
    ];
    expect(detectSharedSignalFraud(groups, 48)).toEqual([]);
  });

  it("flags two groups sharing a creator phone within the window", () => {
    const groups = [
      group({ id: "a", groupName: "A", createdByPhone: "+260971234567", createdAt: "2026-08-20T00:00:00Z" }),
      group({ id: "b", groupName: "B", createdByPhone: "+260971234567", createdAt: "2026-08-21T00:00:00Z" }),
    ];
    const signals = detectSharedSignalFraud(groups, 48);
    expect(signals).toHaveLength(1);
    expect(signals[0].type).toBe("phone");
  });

  it("ignores groups with no creation fingerprint at all", () => {
    const groups = [group({ id: "a" }), group({ id: "b" })];
    expect(detectSharedSignalFraud(groups)).toEqual([]);
  });

  it("does not double-flag a cluster of 3+ groups as multiple signals", () => {
    const groups = [
      group({ id: "a", createdIp: "1.2.3.4", createdAt: "2026-08-20T00:00:00Z" }),
      group({ id: "b", createdIp: "1.2.3.4", createdAt: "2026-08-20T01:00:00Z" }),
      group({ id: "c", createdIp: "1.2.3.4", createdAt: "2026-08-20T02:00:00Z" }),
    ];
    const signals = detectSharedSignalFraud(groups, 48);
    expect(signals).toHaveLength(1);
    expect(signals[0].groups).toHaveLength(3);
  });

  it("respects a custom window", () => {
    const groups = [
      group({ id: "a", createdIp: "1.2.3.4", createdAt: "2026-08-20T00:00:00Z" }),
      group({ id: "b", createdIp: "1.2.3.4", createdAt: "2026-08-21T00:00:00Z" }), // 24h apart
    ];
    expect(detectSharedSignalFraud(groups, 12)).toEqual([]);
    expect(detectSharedSignalFraud(groups, 24)).toHaveLength(1);
  });
});
