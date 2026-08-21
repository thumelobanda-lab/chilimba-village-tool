import { describe, it, expect } from "vitest";
import {
  MESSAGE_CATEGORIES, getMessageCategory, applyTemplatePlaceholders, buildContactLabel,
} from "./messageTemplates.js";

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

  it("every template includes a [Contact] placeholder for a next step", () => {
    for (const c of MESSAGE_CATEGORIES) {
      expect(c.template).toContain("[Contact]");
    }
  });

  it("fraud_warning and account_suspended spell out a clear resolve/appeal path, not just the problem", () => {
    const fraud = getMessageCategory("fraud_warning").template.toLowerCase();
    const suspended = getMessageCategory("account_suspended").template.toLowerCase();
    expect(fraud).toContain("contact us");
    expect(suspended).toMatch(/appeal|resolve/);
    expect(suspended).toContain("contact us");
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

describe("buildContactLabel", () => {
  it("uses just the email when only email is set", () => {
    expect(buildContactLabel({ supportEmail: "support@chilimbacircle.app" })).toBe("support@chilimbacircle.app");
  });

  it("uses just WhatsApp, labeled, when only WhatsApp is set", () => {
    expect(buildContactLabel({ supportWhatsapp: "+260971234567" })).toBe("WhatsApp +260971234567");
  });

  it("joins both with 'or' when both are set", () => {
    expect(buildContactLabel({ supportEmail: "support@x.com", supportWhatsapp: "+260971234567" }))
      .toBe("support@x.com or WhatsApp +260971234567");
  });

  it("returns an empty string when neither is set", () => {
    expect(buildContactLabel({})).toBe("");
    expect(buildContactLabel()).toBe("");
  });
});

describe("applyTemplatePlaceholders", () => {
  it("substitutes [Group Name], [Date], and [Contact] wherever they appear", () => {
    const filled = applyTemplatePlaceholders(
      "Hello [Group Name], as of [Date] your group [Group Name] is fine. Contact: [Contact]",
      { groupName: "Hillcrest Chilimba", dateLabel: "21 Aug 2026", contactLabel: "support@x.com" }
    );
    expect(filled).toBe("Hello Hillcrest Chilimba, as of 21 Aug 2026 your group Hillcrest Chilimba is fine. Contact: support@x.com");
  });

  it("leaves other bracketed placeholders untouched", () => {
    const filled = applyTemplatePlaceholders("Reason: [Reason], Amount: [Amount]", {
      groupName: "X", dateLabel: "1 Jan 2026", contactLabel: "support@x.com",
    });
    expect(filled).toBe("Reason: [Reason], Amount: [Amount]");
  });

  it("leaves [Group Name]/[Date]/[Contact] as literal text when no values are given", () => {
    expect(applyTemplatePlaceholders("Hi [Group Name] on [Date], contact [Contact]"))
      .toBe("Hi [Group Name] on [Date], contact [Contact]");
  });

  it("leaves [Contact] literal when buildContactLabel returned an empty string", () => {
    const filled = applyTemplatePlaceholders("Contact: [Contact]", { contactLabel: buildContactLabel({}) });
    expect(filled).toBe("Contact: [Contact]");
  });

  it("every real template resolves [Group Name], [Date], and [Contact], leaving all other brackets intact", () => {
    for (const c of MESSAGE_CATEGORIES) {
      const filled = applyTemplatePlaceholders(c.template, {
        groupName: "Hillcrest Chilimba", dateLabel: "21 Aug 2026", contactLabel: "support@chilimbacircle.app",
      });
      expect(filled).not.toContain("[Group Name]");
      expect(filled).not.toContain("[Date]");
      expect(filled).not.toContain("[Contact]");
    }
  });
});
