import { describe, it, expect } from "vitest";
import { parseServerTimestamp } from "./serverTime.js";

describe("parseServerTimestamp", () => {
  it("returns null for a missing value", () => {
    expect(parseServerTimestamp(null)).toBe(null);
    expect(parseServerTimestamp("")).toBe(null);
  });

  it("parses SQLite's space-separated datetime('now') format as UTC", () => {
    const d = parseServerTimestamp("2026-08-22 14:01:52");
    expect(d.toISOString()).toBe("2026-08-22T14:01:52.000Z");
  });

  it("is stable regardless of the host's local timezone (no local-time drift)", () => {
    // The historical bug: new Date("2026-08-22 14:01:52") parses as
    // LOCAL time in V8, so its UTC hour shifts with the machine's
    // timezone. This must always come out at exactly 14:01:52 UTC.
    const d = parseServerTimestamp("2026-08-22 14:01:52");
    expect(d.getUTCHours()).toBe(14);
    expect(d.getUTCMinutes()).toBe(1);
  });

  it("passes through an already-ISO value with a Z unchanged", () => {
    const d = parseServerTimestamp("2026-08-22T14:01:52.000Z");
    expect(d.toISOString()).toBe("2026-08-22T14:01:52.000Z");
  });

  it("passes through an already-ISO value with an explicit offset unchanged", () => {
    const d = parseServerTimestamp("2026-08-22T16:01:52+02:00");
    expect(d.toISOString()).toBe("2026-08-22T14:01:52.000Z");
  });
});
