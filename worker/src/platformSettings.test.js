import { describe, it, expect } from "vitest";
import { validateSupportContact, MAX_CONTACT_FIELD_LENGTH } from "./platformSettings.js";

describe("validateSupportContact", () => {
  it("trims both fields", () => {
    expect(validateSupportContact({ supportEmail: "  a@b.com  ", supportWhatsapp: " +260971234567 " }))
      .toEqual({ supportEmail: "a@b.com", supportWhatsapp: "+260971234567" });
  });

  it("normalizes an empty/missing field to null", () => {
    expect(validateSupportContact({ supportEmail: "a@b.com" })).toEqual({ supportEmail: "a@b.com", supportWhatsapp: null });
    expect(validateSupportContact({})).toEqual({ supportEmail: null, supportWhatsapp: null });
    expect(validateSupportContact()).toEqual({ supportEmail: null, supportWhatsapp: null });
  });

  it("rejects a field over the max length", () => {
    const tooLong = "a".repeat(MAX_CONTACT_FIELD_LENGTH + 1);
    expect(() => validateSupportContact({ supportEmail: tooLong })).toThrow(String(MAX_CONTACT_FIELD_LENGTH));
    expect(() => validateSupportContact({ supportWhatsapp: tooLong })).toThrow(String(MAX_CONTACT_FIELD_LENGTH));
  });

  it("accepts a field exactly at the max length", () => {
    const exact = "a".repeat(MAX_CONTACT_FIELD_LENGTH);
    expect(validateSupportContact({ supportEmail: exact }).supportEmail).toBe(exact);
  });
});
