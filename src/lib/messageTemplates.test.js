import { describe, it, expect } from "vitest";
import { MESSAGE_CATEGORIES, getMessageCategory, applyTemplatePlaceholders } from "./messageTemplates.js";

describe("MESSAGE_CATEGORIES", () => {
  it("has exactly the six required categories", () => {
    expect(MESSAGE_CATEGORIES.map((c) => c.id)).toEqual([
      "fraud_warning",
      "spam_abuse",
      "subscription_reminder",
      "account_suspended",
      "general_announcement",
      "payment_dispute",
    ]);
  });

  it("every category has a label, icon, distinct tagColor, and non-empty template", () => {
    const tagColors = new Set();
    for (const c of MESSAGE_CATEGORIES) {
      expect(c.label).toBeTruthy();
      expect(c.icon).toBeTruthy();
      expect(c.template.length).toBeGreaterThan(0);
      tagColors.add(c.tagColor);
    }
    expect(tagColors.size).toBe(MESSAGE_CATEGORIES.length);
  });

  it("keeps every template's tone non-accusatory (no blame-first phrasing)", () => {
    const bannedPhrases = ["your fault", "you violated", "you are guilty", "you failed to", "you did this"];
    for (const c of MESSAGE_CATEGORIES) {
      const lower = c.template.toLowerCase();
      for (const phrase of bannedPhrases) {
        expect(lower).not.toContain(phrase);
      }
    }
  });
});

describe("getMessageCategory", () => {
  it("finds a category by id", () => {
    expect(getMessageCategory("fraud_warning")?.label).toBe("Fraud Warning");
  });

  it("returns null for an unknown id", () => {
    expect(getMessageCategory("nope")).toBeNull();
  });
});

describe("applyTemplatePlaceholders", () => {
  it("substitutes [Group Name] and [Date] wherever they appear", () => {
    const filled = applyTemplatePlaceholders("Hello [Group Name], as of [Date] your group [Group Name] is fine.", {
      groupName: "Hillcrest Chilimba",
      dateLabel: "21 Aug 2026",
    });
    expect(filled).toBe("Hello Hillcrest Chilimba, as of 21 Aug 2026 your group Hillcrest Chilimba is fine.");
  });

  it("leaves other bracketed placeholders untouched", () => {
    const filled = applyTemplatePlaceholders("Reason: [Reason], Amount: [Amount]", {
      groupName: "X", dateLabel: "1 Jan 2026",
    });
    expect(filled).toBe("Reason: [Reason], Amount: [Amount]");
  });

  it("leaves [Group Name]/[Date] as literal text when no values are given", () => {
    expect(applyTemplatePlaceholders("Hi [Group Name] on [Date]")).toBe("Hi [Group Name] on [Date]");
  });

  it("every real template only resolves [Group Name] and [Date], leaving all other brackets intact", () => {
    for (const c of MESSAGE_CATEGORIES) {
      const filled = applyTemplatePlaceholders(c.template, { groupName: "Hillcrest Chilimba", dateLabel: "21 Aug 2026" });
      expect(filled).not.toContain("[Group Name]");
      expect(filled).not.toContain("[Date]");
    }
  });
});
