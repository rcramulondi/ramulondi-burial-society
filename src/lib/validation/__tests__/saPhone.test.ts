import { describe, it, expect } from "vitest";
import { normalizeSaPhone, validateSaPhone } from "../saPhone";

describe("saPhone", () => {
  it("normalizes local 0-prefixed numbers to +27", () => {
    expect(normalizeSaPhone("0821234567")).toBe("+27821234567");
  });

  it("leaves +27 numbers unchanged", () => {
    expect(normalizeSaPhone("+27821234567")).toBe("+27821234567");
  });

  it("strips spaces and dashes before normalizing", () => {
    expect(normalizeSaPhone("082 123-4567")).toBe("+27821234567");
  });

  it("validates a correct mobile number", () => {
    expect(validateSaPhone("0821234567").valid).toBe(true);
  });

  it("rejects numbers that are too short", () => {
    expect(validateSaPhone("08212345").valid).toBe(false);
  });

  it("rejects a number starting with 0 after the country code segment (leading zero after 0)", () => {
    expect(validateSaPhone("0021234567").valid).toBe(false);
  });

  it("rejects non-SA formats", () => {
    expect(validateSaPhone("+1 555 123 4567").valid).toBe(false);
  });
});
