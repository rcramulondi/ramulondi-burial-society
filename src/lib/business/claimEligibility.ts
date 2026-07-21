import { prisma } from "../prisma";
import { getSetting } from "../settings";
import { deriveMemberStatus } from "./memberStatus";
import { getOutstandingBalance } from "./contributionAllocation";
import type { BurialSite } from "@prisma/client";

export type ClaimSubmissionCheck = { eligible: true } | { eligible: false; reason: string };

/**
 * Whether a claim can be *submitted* for a member's death, or for the death
 * of one of their beneficiaries. Distinct from payout authorization (see
 * `assertPayoutAllowed`) — per the constitution, a claim can be filed but the
 * payout withheld while arrears are outstanding.
 *
 * Unlike the member's own record, claim submission no longer requires
 * `member.deceasedDate` to already be set — the claim's own `dateDeceased`
 * is the source of truth, and approval (not submission) is what marks the
 * member/beneficiary deceased. Good standing is always evaluated against the
 * MEMBER's own contribution history, regardless of whether the deceased is
 * the member or one of their beneficiaries (beneficiaries have no
 * independent contribution history — the claim draws against the member's
 * policy either way).
 */
export async function checkClaimSubmissionEligibility(
  memberId: string,
  opts: { dateDeceased: Date; beneficiaryId?: string | null }
): Promise<ClaimSubmissionCheck> {
  const member = await prisma.member.findUniqueOrThrow({ where: { id: memberId } });

  if (opts.beneficiaryId) {
    const beneficiary = await prisma.beneficiary.findUnique({ where: { id: opts.beneficiaryId } });
    if (!beneficiary || beneficiary.memberId !== memberId) {
      return { eligible: false, reason: "This beneficiary does not belong to the specified member." };
    }
    if (beneficiary.status === "DECEASED") {
      return { eligible: false, reason: "This beneficiary is already recorded as deceased." };
    }
    const existingClaim = await prisma.claim.findFirst({ where: { beneficiaryId: opts.beneficiaryId } });
    if (existingClaim) {
      return { eligible: false, reason: "A claim has already been submitted for this beneficiary." };
    }
  } else {
    const existingClaim = await prisma.claim.findFirst({ where: { memberId, beneficiaryId: null } });
    if (existingClaim) {
      return { eligible: false, reason: "A claim has already been submitted for this member." };
    }
  }

  const coolingOffMonths = await getSetting("COOLING_OFF_MONTHS");
  const coolingOffEnds = new Date(member.dateJoined);
  coolingOffEnds.setMonth(coolingOffEnds.getMonth() + coolingOffMonths);
  if (opts.dateDeceased < coolingOffEnds) {
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
    today: opts.dateDeceased,
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

/**
 * Computes the payout amount from the annually-maintained ClaimRate table —
 * a flat base amount for every claim, plus an additional burial-site amount
 * when burial is not at Khalavha. Both rates are effective-dated, mirroring
 * ContributionRate, and are looked up as of the given date (the claim's
 * approval date, since that's when the payout amount is authoritative).
 */
export async function computeClaimPayoutAmount(claim: { placeOfBurial: BurialSite }, asOf: Date = new Date()): Promise<number> {
  const rates = await prisma.claimRate.findMany({
    where: {
      effectiveFrom: { lte: asOf },
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: asOf } }],
    },
  });

  const rateFor = (type: "BASE_PAYOUT" | "ADDITIONAL_BURIAL_SITE") =>
    rates.find((r) => r.type === type)?.amount ?? 0;

  let total = Number(rateFor("BASE_PAYOUT"));
  if (claim.placeOfBurial !== "KHALAVHA") {
    total += Number(rateFor("ADDITIONAL_BURIAL_SITE"));
  }
  return Math.round(total * 100) / 100;
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
