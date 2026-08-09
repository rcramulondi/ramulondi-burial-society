import { describe, it, expect } from "vitest";
import { formatDate, formatCurrency } from "../format";

describe("formatDate", () => {
  it("formats a Date as dd/mm/yyyy using UTC fields", () => {
    expect(formatDate(new Date(Date.UTC(2026, 1, 9)))).toBe("09/02/2026");
  });

  it("pads single-digit day and month", () => {
    expect(formatDate(new Date(Date.UTC(2026, 0, 5)))).toBe("05/01/2026");
  });

  it("parses a date string", () => {
    expect(formatDate("2026-02-09T00:00:00.000Z")).toBe("09/02/2026");
  });

  it("returns an em dash for null/undefined/invalid input", () => {
    expect(formatDate(null)).toBe("—");
    expect(formatDate(undefined)).toBe("—");
    expect(formatDate("not a date")).toBe("—");
  });
});

describe("formatCurrency", () => {
  it("formats with a rand prefix and thousands separators", () => {
    expect(formatCurrency(21500)).toBe("R 21,500.00");
  });

  it("always shows two decimal places", () => {
    expect(formatCurrency(0)).toBe("R 0.00");
    expect(formatCurrency(5)).toBe("R 5.00");
  });

  it("accepts string amounts (e.g. Prisma Decimal serialized)", () => {
    expect(formatCurrency("1234.5")).toBe("R 1,234.50");
  });

  it("treats null/undefined as zero", () => {
    expect(formatCurrency(null)).toBe("R 0.00");
    expect(formatCurrency(undefined)).toBe("R 0.00");
  });

  it("keeps the sign on negative amounts", () => {
    expect(formatCurrency(-42)).toBe("R -42.00");
  });
});
