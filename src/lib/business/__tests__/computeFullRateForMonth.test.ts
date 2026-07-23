import { describe, it, expect } from "vitest";
import { computeFullRateForMonth } from "../contributionAllocation";

const rates = [
  {
    id: "r1",
    membershipType: "MAIN" as const,
    fund: "BURIAL" as const,
    amount: 70 as unknown as never,
    effectiveFrom: new Date(Date.UTC(2020, 0, 1)),
    effectiveTo: new Date(Date.UTC(2026, 0, 1)),
    createdByUserId: null,
    createdAt: new Date(),
  },
  {
    id: "r2",
    membershipType: "MAIN" as const,
    fund: "BURIAL" as const,
    amount: 100 as unknown as never,
    effectiveFrom: new Date(Date.UTC(2026, 0, 1)),
    effectiveTo: null,
    createdByUserId: null,
    createdAt: new Date(),
  },
  {
    id: "r3",
    membershipType: "MAIN" as const,
    fund: "FOOD" as const,
    amount: 10 as unknown as never,
    effectiveFrom: new Date(Date.UTC(2020, 0, 1)),
    effectiveTo: null,
    createdByUserId: null,
    createdAt: new Date(),
  },
];

describe("computeFullRateForMonth", () => {
  it("sums BURIAL + FOOD for the effective rate at that month", () => {
    expect(computeFullRateForMonth(rates, "MAIN", 2025, 6)).toBe(80);
  });

  it("picks up a rate change mid-year", () => {
    expect(computeFullRateForMonth(rates, "MAIN", 2025, 12)).toBe(80);
    expect(computeFullRateForMonth(rates, "MAIN", 2026, 1)).toBe(110);
  });

  it("returns 0 when no rate exists for that membership type", () => {
    expect(computeFullRateForMonth(rates, "KHADZI", 2025, 6)).toBe(0);
  });
});
