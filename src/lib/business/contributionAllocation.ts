import { Fund, PaymentCategory, ContributionRate, PaymentAllocation, MembershipType } from "@prisma/client";
import { prisma } from "../prisma";
import { refreshMemberStatus } from "./memberStatus";

const FORWARD_WINDOW_MONTHS = 24;
const FUNDS: Fund[] = ["BURIAL", "FOOD"];

type Period = { year: number; month: number };

function addMonths(period: Period, n: number): Period {
  const d = new Date(Date.UTC(period.year, period.month - 1 + n, 1));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
}

function comparePeriods(a: Period, b: Period): number {
  return a.year - b.year || a.month - b.month;
}

/**
 * Records a member payment and apportions it across outstanding months/funds,
 * oldest first, splitting the final partial period proportionally across
 * BURIAL/FOOD. Rate changes mid-cycle are handled naturally since each period
 * looks up its own effective rate. Any amount left over after the forward
 * window is flagged in the payment's notes for manual admin follow-up.
 */
export async function recordPaymentWithAllocation(input: {
  memberId: string;
  amount: number;
  paymentDate: Date;
  category: PaymentCategory;
  method?: string;
  reference?: string;
  notes?: string;
  recordedByUserId?: string;
}): Promise<{ paymentId: string; unallocatedAmount: number }> {
  if (input.category === "JOINING_FEE") {
    const payment = await prisma.payment.create({
      data: {
        memberId: input.memberId,
        category: "JOINING_FEE",
        amount: input.amount,
        paymentDate: input.paymentDate,
        method: input.method,
        reference: input.reference,
        notes: input.notes,
        recordedByUserId: input.recordedByUserId,
      },
    });
    return { paymentId: payment.id, unallocatedAmount: 0 };
  }

  const member = await prisma.member.findUniqueOrThrow({ where: { id: input.memberId } });
  const start: Period = (() => {
    const d = member.reinstatementDate ?? member.dateJoined;
    return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
  })();
  const end = addMonths(
    { year: input.paymentDate.getUTCFullYear(), month: input.paymentDate.getUTCMonth() + 1 },
    FORWARD_WINDOW_MONTHS
  );

  const [rates, existingAllocations] = await Promise.all([
    prisma.contributionRate.findMany({ where: { membershipType: member.type } }),
    prisma.paymentAllocation.findMany({ where: { memberId: member.id } }),
  ]);

  const rateFor = (fund: Fund, periodDate: Date) =>
    rates.find(
      (r) =>
        r.fund === fund &&
        r.effectiveFrom <= periodDate &&
        (r.effectiveTo === null || periodDate < r.effectiveTo)
    );

  const alreadyAllocated = (fund: Fund, p: Period) =>
    existingAllocations
      .filter((a) => a.fund === fund && a.year === p.year && a.month === p.month)
      .reduce((sum, a) => sum + Number(a.amount), 0);

  const periods: Period[] = [];
  for (let p = start; comparePeriods(p, end) <= 0; p = addMonths(p, 1)) {
    periods.push(p);
  }
  periods.sort(comparePeriods);

  let remaining = input.amount;
  const newAllocations: { fund: Fund; year: number; month: number; amount: number }[] = [];

  for (const period of periods) {
    if (remaining <= 0) break;
    const periodDate = new Date(Date.UTC(period.year, period.month - 1, 1));

    const outstandingByFund = FUNDS.map((fund) => {
      const rate = rateFor(fund, periodDate);
      const rateAmount = rate ? Number(rate.amount) : 0;
      const paid = alreadyAllocated(fund, period);
      return { fund, outstanding: Math.max(0, rateAmount - paid) };
    });
    const periodOutstanding = outstandingByFund.reduce((s, f) => s + f.outstanding, 0);
    if (periodOutstanding <= 0) continue;

    if (remaining >= periodOutstanding) {
      for (const { fund, outstanding } of outstandingByFund) {
        if (outstanding > 0) {
          newAllocations.push({ fund, year: period.year, month: period.month, amount: outstanding });
        }
      }
      remaining -= periodOutstanding;
    } else {
      for (const { fund, outstanding } of outstandingByFund) {
        if (outstanding > 0) {
          const share = (outstanding / periodOutstanding) * remaining;
          newAllocations.push({ fund, year: period.year, month: period.month, amount: round2(share) });
        }
      }
      remaining = 0;
    }
  }

  const unallocatedAmount = round2(remaining);
  const notes = [input.notes, unallocatedAmount > 0
    ? `R${unallocatedAmount.toFixed(2)} could not be allocated within the ${FORWARD_WINDOW_MONTHS}-month forward window — needs manual admin follow-up.`
    : null,
  ].filter(Boolean).join(" ") || undefined;

  const paymentId = await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.create({
      data: {
        memberId: input.memberId,
        category: "MONTHLY_CONTRIBUTION",
        amount: input.amount,
        paymentDate: input.paymentDate,
        method: input.method,
        reference: input.reference,
        notes,
        recordedByUserId: input.recordedByUserId,
      },
    });

    if (newAllocations.length > 0) {
      await tx.paymentAllocation.createMany({
        data: newAllocations.map((a) => ({
          paymentId: payment.id,
          memberId: input.memberId,
          fund: a.fund,
          year: a.year,
          month: a.month,
          amount: a.amount,
        })),
      });
    }

    return payment.id;
  });

  await refreshMemberStatus(input.memberId, new Date());

  return { paymentId, unallocatedAmount };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Full combined (BURIAL+FOOD) monthly rate for a membership type, effective
 * for the given year/month. Consolidates the "full rate as of a date" math
 * that was previously duplicated (as closures) across memberStatus.ts,
 * contributionAllocation.ts, and claimEligibility.ts — used to color a
 * month's actual contribution red when it falls short of what was due.
 */
export function computeFullRateForMonth(
  rates: ContributionRate[],
  membershipType: MembershipType,
  year: number,
  month: number
): number {
  const periodDate = new Date(Date.UTC(year, month - 1, 1));
  return FUNDS.reduce((sum, fund) => {
    const rate = rates.find(
      (r) =>
        r.membershipType === membershipType &&
        r.fund === fund &&
        r.effectiveFrom <= periodDate &&
        (r.effectiveTo === null || periodDate < r.effectiveTo)
    );
    return sum + (rate ? Number(rate.amount) : 0);
  }, 0);
}

type MemberForOutstanding = { reinstatementDate: Date | null; dateJoined: Date };

/**
 * Pure period-walking math, extracted from getOutstandingBalance so it can
 * also be used by getOutstandingBalancesForMembers without re-fetching rates
 * and allocations per member (avoids N+1 queries when computing this for an
 * entire member list). No DB calls in here.
 */
export function computeOutstanding(
  member: MemberForOutstanding,
  rates: ContributionRate[],
  allocations: PaymentAllocation[],
  asOf: Date = new Date()
): number {
  const start: Period = (() => {
    const d = member.reinstatementDate ?? member.dateJoined;
    return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
  })();
  const end: Period = { year: asOf.getUTCFullYear(), month: asOf.getUTCMonth() + 1 };
  if (comparePeriods(start, end) > 0) return 0;

  const rateFor = (fund: Fund, periodDate: Date) =>
    rates.find(
      (r) =>
        r.fund === fund &&
        r.effectiveFrom <= periodDate &&
        (r.effectiveTo === null || periodDate < r.effectiveTo)
    );
  const alreadyAllocated = (fund: Fund, p: Period) =>
    allocations
      .filter((a) => a.fund === fund && a.year === p.year && a.month === p.month)
      .reduce((sum, a) => sum + Number(a.amount), 0);

  let outstanding = 0;
  for (let p = start; comparePeriods(p, end) <= 0; p = addMonths(p, 1)) {
    const periodDate = new Date(Date.UTC(p.year, p.month - 1, 1));
    for (const fund of FUNDS) {
      const rate = rateFor(fund, periodDate);
      const rateAmount = rate ? Number(rate.amount) : 0;
      outstanding += Math.max(0, rateAmount - alreadyAllocated(fund, p));
    }
  }
  return round2(outstanding);
}

/**
 * Total outstanding contribution balance for a member, summed across all
 * fully-elapsed months from their join/reinstatement date through `asOf`
 * (inclusive of the current month). Used to gate claim payouts — the
 * constitution requires all outstanding funds to be settled before a payout
 * is disbursed.
 */
export async function getOutstandingBalance(memberId: string, asOf: Date = new Date()): Promise<number> {
  const member = await prisma.member.findUniqueOrThrow({ where: { id: memberId } });
  const [rates, allocations] = await Promise.all([
    prisma.contributionRate.findMany({ where: { membershipType: member.type } }),
    prisma.paymentAllocation.findMany({ where: { memberId } }),
  ]);
  return computeOutstanding(member, rates, allocations, asOf);
}

/**
 * Batched outstanding-balance + contributions-to-date for a whole list of
 * members in 3 queries total, regardless of list size (member list screen
 * needs this per-row without N+1ing). Contributions-to-date reuses the same
 * in-memory allocation grouping as the outstanding-balance computation.
 */
export async function getOutstandingBalancesForMembers(
  memberIds: string[],
  asOf: Date = new Date()
): Promise<Map<string, { outstandingBalance: number; contributionsToDate: number }>> {
  const result = new Map<string, { outstandingBalance: number; contributionsToDate: number }>();
  if (memberIds.length === 0) return result;

  const [members, rates, allocations] = await Promise.all([
    prisma.member.findMany({ where: { id: { in: memberIds } } }),
    prisma.contributionRate.findMany(),
    prisma.paymentAllocation.findMany({ where: { memberId: { in: memberIds } } }),
  ]);

  const allocationsByMember = new Map<string, PaymentAllocation[]>();
  for (const a of allocations) {
    const list = allocationsByMember.get(a.memberId) ?? [];
    list.push(a);
    allocationsByMember.set(a.memberId, list);
  }

  for (const member of members) {
    const memberAllocations = allocationsByMember.get(member.id) ?? [];
    const memberRates = rates.filter((r) => r.membershipType === member.type);
    result.set(member.id, {
      outstandingBalance: computeOutstanding(member, memberRates, memberAllocations, asOf),
      contributionsToDate: round2(memberAllocations.reduce((sum, a) => sum + Number(a.amount), 0)),
    });
  }

  return result;
}
