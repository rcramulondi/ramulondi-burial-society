import { describe, it, expect } from "vitest";
import { validateSaId } from "../saId";

describe("validateSaId", () => {
  it("accepts a known-valid ID number and derives DOB/gender/citizenship", () => {
    const result = validateSaId("8001015009087");
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.dateOfBirth.getUTCFullYear()).toBe(1980);
      expect(result.dateOfBirth.getUTCMonth()).toBe(0);
      expect(result.dateOfBirth.getUTCDate()).toBe(1);
      expect(result.gender).toBe("MALE");
      expect(result.citizen).toBe(true);
    }
  });

  it("rejects a tampered checksum digit", () => {
    const result = validateSaId("8001015009088");
    expect(result.valid).toBe(false);
  });

  it("rejects wrong length", () => {
    expect(validateSaId("12345").valid).toBe(false);
    expect(validateSaId("80010150090871234").valid).toBe(false);
  });

  it("rejects non-numeric input", () => {
    expect(validateSaId("800101500908A").valid).toBe(false);
  });

  it("rejects an invalid embedded date", () => {
    // Month 13 is impossible.
    expect(validateSaId("8013015009087").valid).toBe(false);
  });

  it("derives female gender and citizen status for gender-digit segments under 5000", () => {
    // 911225 0001 0 8 2 — DOB 1991-12-25, gender segment 0001 (< 5000 -> female),
    // citizenship digit 0 (-> citizen), checksum computed via the same algorithm.
    const result = validateSaId("9112250001082");
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.gender).toBe("FEMALE");
      expect(result.citizen).toBe(true);
      expect(result.dateOfBirth.getUTCFullYear()).toBe(1991);
    }
  });

  it("empty/whitespace input is invalid", () => {
    expect(validateSaId("").valid).toBe(false);
    expect(validateSaId("   ").valid).toBe(false);
  });
});
