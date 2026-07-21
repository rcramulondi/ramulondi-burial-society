import type { Fund, MembershipType, ContributionRate } from "@prisma/client";
import { prisma } from "../prisma";

const MEMBERSHIP_TYPES: MembershipType[] = ["MAIN", "KHADZI"];
const FUNDS: Fund[] = ["BURIAL", "FOOD"];

export type ActiveCounts = Record<MembershipType, number>;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function rateEffectiveOn(rates: ContributionRate[], type: MembershipType, fund: Fund, date: Date): number {
  const rate = rates.find(
    (r) =>
      r.membershipType === type &&
      r.fund === fund &&
      r.effectiveFrom <= date &&
      (r.effectiveTo === null || date < r.effectiveTo)
  );
  return rate ? Number(rate.amount) : 0;
}

/**
 * Projected contributions for one month, using CURRENT active headcount per
 * membership type as a proxy (no historical headcount is tracked) applied to
 * whichever rate was effective that month. This is an approximation — always
 * surfaced next to the actual/variance so admins can sanity-check it, not as
 * a standalone number.
 */
export function projectedForMonth(
  activeCounts: ActiveCounts,
  rates: ContributionRate[],
  year: number,
  month: number
): number {
  const periodDate = new Date(Date.UTC(year, month - 1, 1));
  let total = 0;
  for (const type of MEMBERSHIP_TYPES) {
    for (const fund of FUNDS) {
      total += activeCounts[type] * rateEffectiveOn(rates, type, fund, periodDate);
    }
  }
  return round2(total);
}

export function projectedForYear(activeCounts: ActiveCounts, rates: ContributionRate[], year: number): number {
  let total = 0;
  for (let month = 1; month <= 12; month++) {
    total += projectedForMonth(activeCounts, rates, year, month);
  }
  return round2(total);
}

/**
 * Shared by the dashboard summary and its year drill-down so both compute
 * "current active headcount per membership type" + rate history the same
 * way, in one DB round trip each, rather than duplicating the query.
 */
export async function getActiveCountsAndRates(): Promise<{ activeCounts: ActiveCounts; rates: ContributionRate[] }> {
  const [typeStatusCounts, rates] = await Promise.all([
    prisma.member.groupBy({ by: ["type", "status"], _count: true }),
    prisma.contributionRate.findMany(),
  ]);

  const activeCounts: ActiveCounts = { MAIN: 0, KHADZI: 0 };
  for (const row of typeStatusCounts) {
    if (row.status === "ACTIVE" || row.status === "ABOUT_TO_LAPSE") {
      activeCounts[row.type] += row._count;
    }
  }

  return { activeCounts, rates };
}
