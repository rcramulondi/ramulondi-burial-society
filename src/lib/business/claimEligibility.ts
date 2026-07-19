import { prisma } from "../prisma";
import { getSetting } from "../settings";
import { deriveMemberStatus } from "./memberStatus";
import { getOutstandingBalance } from "./contributionAllocation";

export type ClaimSubmissionCheck = { eligible: true } | { eligible: false; reason: string };

/**
 * Whether a member's death qualifies for a claim to be *submitted*.
 * Distinct from payout authorization (see `assertPayoutAllowed`) — per the
 * constitution, a claim can be filed but the payout withheld while arrears
 * are outstanding.
 */
export async function checkClaimSubmissionEligibility(memberId: string): Promise<ClaimSubmissionCheck> {
  const member = await prisma.member.findUniqueOrThrow({ where: { id: memberId } });

  if (!member.deceasedDate) {
    return { eligible: false, reason: "This member is not recorded as deceased." };
  }

  const existingClaim = await prisma.claim.findUnique({ where: { memberId } });
  if (existingClaim) {
    return { eligible: false, reason: "A claim has already been submitted for this member." };
  }

  const coolingOffMonths = await getSetting("COOLING_OFF_MONTHS");
  const coolingOffEnds = new Date(member.dateJoined);
  coolingOffEnds.setMonth(coolingOffEnds.getMonth() + coolingOffMonths);
  if (member.deceasedDate < coolingOffEnds) {
    return {
      eligible: false,
      reason: `This member died before completing the ${coolingOffMonths}-month cooling-off period from their join date (${member.dateJoined.toDateString()}).`,
    };
  }

  // Was the member already terminated (lapsed) as of the date they died?
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

  const statusAtDeath = deriveMemberStatus({
    deceasedDate: null, // evaluate arrears status as of the death date, ignoring the deceased flag itself
    dateJoined: member.dateJoined,
    reinstatementDate: member.reinstatementDate,
    today: member.deceasedDate,
    fullRateFor,
    paidAmountFor,
    lastMonthWithAnyPayment,
    lapseMonths,
    warningMonths,
  });

  if (statusAtDeath.status === "IN_ACTIVE") {
    return {
      eligible: false,
      reason: "This member's membership had already lapsed (6+ consecutive months in arrears) before they died, per the constitution's termination rule.",
    };
  }

  return { eligible: true };
}

export class ClaimPayoutBlockedError extends Error {}

/**
 * Payout authorization is blocked while any contribution balance remains
 * outstanding, even inside the arrears grace period — "no funds will be
 * disbursed... until settled" per the constitution.
 */
export async function assertPayoutAllowed(memberId: string, asOf: Date = new Date()): Promise<void> {
  const outstanding = await getOutstandingBalance(memberId, asOf);
  if (outstanding > 0) {
    throw new ClaimPayoutBlockedError(
      `This member has an outstanding contribution balance of R${outstanding.toFixed(2)}. All outstanding funds must be settled before a payout can be disbursed.`
    );
  }
}
