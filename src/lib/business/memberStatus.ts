import { MemberStatus } from "@prisma/client";
import { prisma } from "../prisma";
import { getSetting } from "../settings";

export type StatusResult = {
  status: MemberStatus;
  terminationDate: Date | null;
};

export type DeriveStatusInput = {
  deceasedDate: Date | null;
  dateJoined: Date;
  reinstatementDate: Date | null;
  today: Date;
  /** Combined (all-fund) full monthly rate effective on the given date. */
  fullRateFor: (date: Date) => number;
  /** Total amount paid (all funds) for a given calendar year/month (1-12). */
  paidAmountFor: (year: number, month: number) => number;
  /** Most recent calendar month (in `today`'s year or earlier) with any payment at all. */
  lastMonthWithAnyPayment: () => { year: number; month: number } | null;
  lapseMonths: number;
  warningMonths: number;
};

/**
 * Pure translation of the source spreadsheet's Status/Termination-date formulas
 * (Members 2026 sheet, columns G/J), with one deliberate correction: a member
 * who joined mid-year is not penalized for months before they joined.
 */
export function deriveMemberStatus(input: DeriveStatusInput): StatusResult {
  if (input.deceasedDate) return { status: "DECEASED", terminationDate: null };

  const start = input.reinstatementDate ?? input.dateJoined;
  const todayYear = input.today.getFullYear();
  const currentMonth = input.today.getMonth() + 1;

  const effectiveStartMonth = start.getFullYear() === todayYear ? start.getMonth() + 1 : 1;
  // Member joins later this year in the future, or hasn't started yet this cycle.
  if (effectiveStartMonth > currentMonth) {
    return { status: "ACTIVE", terminationDate: null };
  }

  const monthsElapsed = Math.max(0, currentMonth - effectiveStartMonth + 1);

  let fullyPaidCount = 0;
  for (let m = effectiveStartMonth; m <= currentMonth; m++) {
    const rate = input.fullRateFor(new Date(Date.UTC(todayYear, m - 1, 1)));
    if (input.paidAmountFor(todayYear, m) >= rate) fullyPaidCount++;
  }
  const gap = monthsElapsed - fullyPaidCount;

  const last = input.lastMonthWithAnyPayment();
  const lastPaidDate = last ? new Date(Date.UTC(last.year, last.month - 1, 1)) : null;
  const terminationCandidate = lastPaidDate
    ? new Date(Date.UTC(lastPaidDate.getUTCFullYear(), lastPaidDate.getUTCMonth() + input.lapseMonths, 1))
    : new Date(Date.UTC(todayYear, 5, 1)); // mirrors the spreadsheet's IFERROR fallback (June of current year)

  if (gap >= input.lapseMonths) {
    if (terminationCandidate <= input.today) {
      return { status: "IN_ACTIVE", terminationDate: terminationCandidate };
    }
    return { status: "ABOUT_TO_LAPSE", terminationDate: null };
  }
  if (gap > input.warningMonths) return { status: "ABOUT_TO_LAPSE", terminationDate: null };
  return { status: "ACTIVE", terminationDate: null };
}

/**
 * Fetches everything `deriveMemberStatus` needs for one member from the
 * database, computes the result, and persists it. Call after any write that
 * could change a member's status (payment recorded, deceasedDate set) and
 * from the daily status-refresh cron.
 */
export async function refreshMemberStatus(memberId: string, today: Date = new Date()): Promise<StatusResult> {
  const member = await prisma.member.findUniqueOrThrow({ where: { id: memberId } });

  const [rates, allocations, settings] = await Promise.all([
    prisma.contributionRate.findMany({ where: { membershipType: member.type } }),
    prisma.paymentAllocation.findMany({ where: { memberId } }),
    Promise.all([getSetting("ARREARS_LAPSE_MONTHS"), getSetting("ARREARS_WARNING_MONTHS")]),
  ]);
  const [lapseMonths, warningMonths] = settings;

  const fullRateFor = (date: Date) =>
    rates
      .filter((r) => r.effectiveFrom <= date && (r.effectiveTo === null || date < r.effectiveTo))
      .reduce((sum, r) => sum + Number(r.amount), 0);

  const paidAmountFor = (year: number, month: number) =>
    allocations
      .filter((a) => a.year === year && a.month === month)
      .reduce((sum, a) => sum + Number(a.amount), 0);

  const lastMonthWithAnyPayment = () => {
    let best: { year: number; month: number } | null = null;
    for (const a of allocations) {
      if (!best || a.year > best.year || (a.year === best.year && a.month > best.month)) {
        best = { year: a.year, month: a.month };
      }
    }
    return best;
  };

  const result = deriveMemberStatus({
    deceasedDate: member.deceasedDate,
    dateJoined: member.dateJoined,
    reinstatementDate: member.reinstatementDate,
    today,
    fullRateFor,
    paidAmountFor,
    lastMonthWithAnyPayment,
    lapseMonths,
    warningMonths,
  });

  await prisma.member.update({
    where: { id: memberId },
    data: {
      status: result.status,
      terminationDate: result.terminationDate,
      statusUpdatedAt: today,
    },
  });

  return result;
}

export async function refreshAllMemberStatuses(today: Date = new Date()): Promise<number> {
  const members = await prisma.member.findMany({ select: { id: true } });
  for (const { id } of members) {
    await refreshMemberStatus(id, today);
  }
  return members.length;
}
