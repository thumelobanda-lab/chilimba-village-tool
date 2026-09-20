import { describe, it, expect } from "vitest";
import { normalizeTitle, normalizeGender, HttpError } from "./auth.js";

// The bug this guards against: title and gender used to share one column
// and one whitelist, so picking a plain honorific like "Dr" was validated
// as if it were a gender and could fail with a gender-flavored error for
// a field the user never saw labeled that way (migration 024 split them).
// These two validators must stay independent — neither's error message
// should ever mention the other's field name.

const TITLE_OPTIONS = ["sister", "brother", "mrs", "mr", "ms", "dr", "father", "madame"];

describe("normalizeTitle", () => {
  it.each(TITLE_OPTIONS)("accepts %j and returns it unchanged", (title) => {
    expect(normalizeTitle(title)).toBe(title);
  });

  it("treats an omitted, null, or empty title as 'no title' (null), not an error", () => {
    expect(normalizeTitle(undefined)).toBeNull();
    expect(normalizeTitle(null)).toBeNull();
    expect(normalizeTitle("")).toBeNull();
  });

  it("rejects an unrecognized title with a title-specific message", () => {
    expect(() => normalizeTitle("professor")).toThrow(HttpError);
    expect(() => normalizeTitle("professor")).toThrow(/title/i);
  });

  it("never accepts a gender value as a title unless it's also a listed honorific", () => {
    expect(() => normalizeTitle("male")).toThrow(/title/i);
    expect(() => normalizeTitle("female")).toThrow(/title/i);
  });

  it("rejected title errors never mention gender", () => {
    try {
      normalizeTitle("professor");
      throw new Error("expected normalizeTitle to throw");
    } catch (e) {
      expect(e.message).not.toMatch(/gender/i);
    }
  });
});

describe("normalizeGender", () => {
  it.each(["male", "female"])("accepts %j and returns it unchanged", (gender) => {
    expect(normalizeGender(gender)).toBe(gender);
  });

  it("treats an omitted, null, or empty gender as unset (null), not an error", () => {
    expect(normalizeGender(undefined)).toBeNull();
    expect(normalizeGender(null)).toBeNull();
    expect(normalizeGender("")).toBeNull();
  });

  it("rejects an honorific/title value — titles are never inferred as a gender", () => {
    expect(() => normalizeGender("dr")).toThrow(HttpError);
    expect(() => normalizeGender("dr")).toThrow(/gender/i);
    expect(() => normalizeGender("mrs")).toThrow(/gender/i);
    expect(() => normalizeGender("father")).toThrow(/gender/i);
  });

  it("rejected gender errors never mention title", () => {
    try {
      normalizeGender("dr");
      throw new Error("expected normalizeGender to throw");
    } catch (e) {
      expect(e.message).not.toMatch(/title/i);
    }
  });
});
