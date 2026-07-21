import { describe, it, expect } from "vitest";
import { projectedForMonth, projectedForYear, rateEffectiveOn } from "../projectedContributions";

const rates = [
  {
    id: "r1",
    membershipType: "MAIN" as const,
    fund: "BURIAL" as const,
    amount: 80 as unknown as never,
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
    amount: 20 as unknown as never,
    effectiveFrom: new Date(Date.UTC(2020, 0, 1)),
    effectiveTo: null,
    createdByUserId: null,
    createdAt: new Date(),
  },
  {
    id: "r4",
    membershipType: "KHADZI" as const,
    fund: "BURIAL" as const,
    amount: 40 as unknown as never,
    effectiveFrom: new Date(Date.UTC(2020, 0, 1)),
    effectiveTo: null,
    createdByUserId: null,
    createdAt: new Date(),
  },
  {
    id: "r5",
    membershipType: "KHADZI" as const,
    fund: "FOOD" as const,
    amount: 10 as unknown as never,
    effectiveFrom: new Date(Date.UTC(2020, 0, 1)),
    effectiveTo: null,
    createdByUserId: null,
    createdAt: new Date(),
  },
];

describe("rateEffectiveOn", () => {
  it("picks the rate whose window covers the date, respecting effectiveTo", () => {
    expect(rateEffectiveOn(rates, "MAIN", "BURIAL", new Date(Date.UTC(2025, 5, 1)))).toBe(80);
    expect(rateEffectiveOn(rates, "MAIN", "BURIAL", new Date(Date.UTC(2026, 5, 1)))).toBe(100);
  });

  it("returns 0 when no rate is effective for that fund/type/date", () => {
    expect(rateEffectiveOn([], "MAIN", "BURIAL", new Date())).toBe(0);
  });
});

describe("projectedForMonth", () => {
  it("sums activeCount x rate across both membership types and funds", () => {
    const activeCounts = { MAIN: 10, KHADZI: 5 };
    // MAIN: 10*80 + 10*20 = 1000; KHADZI: 5*40 + 5*10 = 250
    expect(projectedForMonth(activeCounts, rates, 2025, 6)).toBe(1250);
  });

  it("picks up a rate change mid-year correctly per month", () => {
    const activeCounts = { MAIN: 1, KHADZI: 0 };
    expect(projectedForMonth(activeCounts, rates, 2025, 12)).toBe(80 + 20); // old rate
    expect(projectedForMonth(activeCounts, rates, 2026, 1)).toBe(100 + 20); // new rate
  });
});

describe("projectedForYear", () => {
  it("sums 12 months of projectedForMonth", () => {
    const activeCounts = { MAIN: 1, KHADZI: 0 };
    // 2025: all 12 months at the old MAIN rate (80+20=100/month)
    expect(projectedForYear(activeCounts, rates, 2025)).toBe(1200);
  });
});
