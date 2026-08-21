import { describe, it, expect } from "vitest";
import {
  isValidTargetType, buildTargetLabel, validateMessageBody, MAX_MESSAGE_LENGTH,
  isValidCategory, MESSAGE_CATEGORIES,
} from "./ownerMessages.js";

describe("isValidTargetType", () => {
  it("accepts the three known target types", () => {
    expect(isValidTargetType("user")).toBe(true);
    expect(isValidTargetType("group_admins")).toBe(true);
    expect(isValidTargetType("group_members")).toBe(true);
  });

  it("rejects anything else", () => {
    expect(isValidTargetType("everyone")).toBe(false);
    expect(isValidTargetType("")).toBe(false);
    expect(isValidTargetType(undefined)).toBe(false);
  });
});

describe("buildTargetLabel", () => {
  it("labels an individual with their name and group", () => {
    expect(buildTargetLabel({ targetType: "user", groupName: "Hillcrest Chilimba", userDisplayName: "Harriet Banda" }))
      .toBe("Harriet Banda (Hillcrest Chilimba)");
  });

  it("labels a group-admins broadcast", () => {
    expect(buildTargetLabel({ targetType: "group_admins", groupName: "Hillcrest Chilimba" }))
      .toBe("All admins — Hillcrest Chilimba");
  });

  it("labels a group-members broadcast", () => {
    expect(buildTargetLabel({ targetType: "group_members", groupName: "Hillcrest Chilimba" }))
      .toBe("All members — Hillcrest Chilimba");
  });

  it("throws on an unknown target type", () => {
    expect(() => buildTargetLabel({ targetType: "everyone", groupName: "X" })).toThrow();
  });
});

describe("validateMessageBody", () => {
  it("trims surrounding whitespace", () => {
    expect(validateMessageBody("  hello  ")).toBe("hello");
  });

  it("rejects an empty or whitespace-only message", () => {
    expect(() => validateMessageBody("")).toThrow("required");
    expect(() => validateMessageBody("   ")).toThrow("required");
  });

  it("rejects a message over the max length", () => {
    const tooLong = "a".repeat(MAX_MESSAGE_LENGTH + 1);
    expect(() => validateMessageBody(tooLong)).toThrow(String(MAX_MESSAGE_LENGTH));
  });

  it("accepts a message exactly at the max length", () => {
    const exact = "a".repeat(MAX_MESSAGE_LENGTH);
    expect(validateMessageBody(exact)).toBe(exact);
  });
});

describe("isValidCategory", () => {
  it("accepts every known category id", () => {
    for (const id of MESSAGE_CATEGORIES) expect(isValidCategory(id)).toBe(true);
  });

  it("accepts null/undefined as a valid 'no template' state", () => {
    expect(isValidCategory(null)).toBe(true);
    expect(isValidCategory(undefined)).toBe(true);
  });

  it("rejects an unknown category string", () => {
    expect(isValidCategory("something_else")).toBe(false);
    expect(isValidCategory("")).toBe(false);
  });
});
