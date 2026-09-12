import { describe, it, expect } from "vitest";
import { hashPin, verifyPin, isLegacyHash, randomSalt, generateGroupCode } from "./crypto.js";

describe("hashPin / verifyPin (PBKDF2)", () => {
  it("produces a hash tagged with the pbkdf2 prefix and iteration count", async () => {
    const salt = randomSalt();
    const hash = await hashPin("1234", salt);
    expect(hash).toMatch(/^pbkdf2\$\d+\$[0-9a-f]+$/);
  });

  it("verifies a correct PIN against its own hash", async () => {
    const salt = randomSalt();
    const hash = await hashPin("1234", salt);
    expect(await verifyPin("1234", salt, hash)).toBe(true);
  });

  it("rejects an incorrect PIN", async () => {
    const salt = randomSalt();
    const hash = await hashPin("1234", salt);
    expect(await verifyPin("9999", salt, hash)).toBe(false);
  });

  it("produces different hashes for the same PIN with different salts", async () => {
    const hashA = await hashPin("1234", randomSalt());
    const hashB = await hashPin("1234", randomSalt());
    expect(hashA).not.toBe(hashB);
  });

  it("is not identified as a legacy hash", async () => {
    const hash = await hashPin("1234", randomSalt());
    expect(isLegacyHash(hash)).toBe(false);
  });
}, 20000); // PBKDF2 at 100k iterations takes real time — give the suite room

describe("generateGroupCode", () => {
  it("defaults to a 6-character code", () => {
    expect(generateGroupCode()).toHaveLength(6);
  });

  it("respects a custom length", () => {
    expect(generateGroupCode(10)).toHaveLength(10);
  });

  it("never includes visually ambiguous characters (0/O, 1/I/l)", () => {
    // Generate a lot of codes rather than trust one sample — this is
    // exactly the kind of off-by-one-in-the-alphabet bug that a single
    // lucky/unlucky draw wouldn't catch.
    const codes = Array.from({ length: 500 }, () => generateGroupCode(12)).join("");
    expect(codes).not.toMatch(/[01ilo]/i);
  });

  it("only uses lowercase letters and digits", () => {
    expect(generateGroupCode(20)).toMatch(/^[a-z0-9]+$/);
  });

  it("produces different codes across calls", () => {
    const codes = new Set(Array.from({ length: 20 }, () => generateGroupCode()));
    expect(codes.size).toBeGreaterThan(1);
  });
});

describe("legacy hash backward compatibility", () => {
  // Simulates an account created before the PBKDF2 switch: single-round
  // salted SHA-256, no "pbkdf2$" prefix. Computed the same way the old
  // crypto.js did, so this test would fail if the old format ever
  // silently stopped being verifiable — which would lock out every
  // account created before this change.
  async function legacyHash(pin, salt) {
    const enc = new TextEncoder().encode(salt + ":" + pin);
    const digest = await crypto.subtle.digest("SHA-256", enc);
    return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  it("identifies a hash with no pbkdf2 prefix as legacy", async () => {
    const hash = await legacyHash("1234", "somesalt");
    expect(isLegacyHash(hash)).toBe(true);
  });

  it("still verifies a correct PIN against a legacy-format hash", async () => {
    const salt = randomSalt();
    const hash = await legacyHash("1234", salt);
    expect(await verifyPin("1234", salt, hash)).toBe(true);
  });

  it("still rejects an incorrect PIN against a legacy-format hash", async () => {
    const salt = randomSalt();
    const hash = await legacyHash("1234", salt);
    expect(await verifyPin("9999", salt, hash)).toBe(false);
  });
});
