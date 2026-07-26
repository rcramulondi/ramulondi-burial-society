import { MemberStatus } from "@prisma/client";
import { prisma } from "../prisma";
import { getSetting } from "../settings";

export type StatusResult = {
  status: MemberStatus;
  terminationDate: Date | null;
  /**
   * The same lapse-candidate date the function computes internally,
   * regardless of whether it has arrived yet — non-null for both
   * `IN_ACTIVE` (where it equals `terminationDate`) and `ABOUT_TO_LAPSE`
   * (where it's a future projection, not yet persisted as `terminationDate`).
   * Null for `ACTIVE`/`DECEASED`. Compute-on-read only — never persisted.
   */
  projectedTerminationDate: Date | null;
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
  if (input.deceasedDate) return { status: "DECEASED", terminationDate: null, projectedTerminationDate: null };

  const start = input.reinstatementDate ?? input.dateJoined;
  const todayYear = input.today.getFullYear();
  const currentMonth = input.today.getMonth() + 1;

  const effectiveStartMonth = start.getFullYear() === todayYear ? start.getMonth() + 1 : 1;
  // Member joins later this year in the future, or hasn't started yet this cycle.
  if (effectiveStartMonth > currentMonth) {
    return { status: "ACTIVE", terminationDate: null, projectedTerminationDate: null };
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
      return { status: "IN_ACTIVE", terminationDate: terminationCandidate, projectedTerminationDate: terminationCandidate };
    }
    return { status: "ABOUT_TO_LAPSE", terminationDate: null, projectedTerminationDate: terminationCandidate };
  }
  if (gap > input.warningMonths) return { status: "ABOUT_TO_LAPSE", terminationDate: null, projectedTerminationDate: terminationCandidate };
  return { status: "ACTIVE", terminationDate: null, projectedTerminationDate: null };
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

  // Log a history row on every real transition, plus once as a baseline the
  // first time this member is ever seen here (existingHistoryCount === 0) —
  // that baseline is what lets pre-existing members backfill automatically
  // the next time the daily cron touches them, with no manual data migration.
  const existingHistoryCount = await prisma.memberStatusHistory.count({ where: { memberId } });
  if (existingHistoryCount === 0 || result.status !== member.status) {
    await prisma.memberStatusHistory.create({
      data: { memberId, status: result.status, changedAt: today },
    });
  }

  // Single funnel point for every path that can lead to DECEASED (manual
  // edit, claim approval, future paths): revoke the member's own login so
  // their data is only reachable via an admin account from here on.
  if (result.status === "DECEASED") {
    await prisma.user.updateMany({
      where: { memberId, disabled: false },
      data: { disabled: true, disabledReason: "Member recorded as deceased." },
    });
  }

  return result;
}

export async function refreshAllMemberStatuses(today: Date = new Date()): Promise<number> {
  const members = await prisma.member.findMany({ select: { id: true } });
  for (const { id } of members) {
    await refreshMemberStatus(id, today);
  }
  return members.length;
}

export type StatusCountsAsOf = {
  counts: Record<MemberStatus, number>;
  /**
   * False when at least one member who existed by `cutoff` has no
   * MemberStatusHistory row that old — i.e. status tracking didn't go back
   * far enough yet to reconstruct that date. Callers should fall back to the
   * live snapshot and say so, rather than present partial counts as fact.
   */
  hasFullHistory: boolean;
};

/**
 * Reconstructs the member-status breakdown as of a past date from
 * MemberStatusHistory, rather than the live (current) Member.status column —
 * needed so a year selector can show what the breakdown actually was for a
 * given year instead of always showing today's snapshot.
 */
export async function getMemberStatusCountsAsOf(cutoff: Date): Promise<StatusCountsAsOf> {
  const counts: Record<MemberStatus, number> = { ACTIVE: 0, ABOUT_TO_LAPSE: 0, IN_ACTIVE: 0, DECEASED: 0 };

  const members = await prisma.member.findMany({
    where: { dateJoined: { lt: cutoff } },
    select: { id: true },
  });
  if (members.length === 0) return { counts, hasFullHistory: true };

  const histories = await prisma.memberStatusHistory.findMany({
    where: { memberId: { in: members.map((m) => m.id) }, changedAt: { lt: cutoff } },
    orderBy: { changedAt: "desc" },
    select: { memberId: true, status: true },
  });

  const latestByMember = new Map<string, MemberStatus>();
  for (const h of histories) {
    if (!latestByMember.has(h.memberId)) latestByMember.set(h.memberId, h.status);
  }

  let hasFullHistory = true;
  for (const m of members) {
    const status = latestByMember.get(m.id);
    if (status) {
      counts[status]++;
    } else {
      hasFullHistory = false;
    }
  }

  return { counts, hasFullHistory };
}
