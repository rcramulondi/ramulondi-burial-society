import { prisma } from "../prisma";
import { getSetting } from "../settings";

export class BeneficiaryRuleError extends Error {}

/**
 * Friendly pre-check for the one-Father/one-Mother-per-member rule. The
 * database also enforces this via a partial unique index (see migration
 * 0002_beneficiary_partial_unique_indexes) as the source of truth under
 * concurrent writes — this check just produces a clear error message instead
 * of a raw constraint-violation for the common case.
 */
export async function assertSingleParentSlotAvailable(
  memberId: string,
  relationship: "FATHER" | "MOTHER",
  excludeBeneficiaryId?: string
): Promise<void> {
  const existing = await prisma.beneficiary.findFirst({
    where: {
      memberId,
      relationship,
      deletedAt: null,
      ...(excludeBeneficiaryId ? { id: { not: excludeBeneficiaryId } } : {}),
    },
  });
  if (existing) {
    throw new BeneficiaryRuleError(
      `This member already has a beneficiary recorded as ${relationship === "FATHER" ? "Father" : "Mother"}. Remove or update the existing record instead of adding another.`
    );
  }
}

/**
 * Enforces "beneficiaries can be deleted, but only once within a rolling
 * 12-month period" — scoped to the member (not per-beneficiary), matching
 * the constitution's intent that beneficiary lists shouldn't be churned.
 */
export async function assertDeletionAllowed(memberId: string): Promise<void> {
  const windowMonths = await getSetting("BENEFICIARY_DELETION_WINDOW_MONTHS");
  const since = new Date();
  since.setMonth(since.getMonth() - windowMonths);

  const recentDeletion = await prisma.auditLog.findFirst({
    where: {
      entityType: "Beneficiary",
      action: "DELETE",
      memberId,
      createdAt: { gte: since },
    },
    orderBy: { createdAt: "desc" },
  });

  if (recentDeletion) {
    throw new BeneficiaryRuleError(
      `A beneficiary was already removed for this member within the last ${windowMonths} months (on ${recentDeletion.createdAt.toDateString()}). Only one deletion is allowed per rolling ${windowMonths}-month period.`
    );
  }
}

/**
 * Blocks re-registering someone already recorded as a DECEASED beneficiary.
 * Matched globally by ID number (not scoped to memberId) — idNumber is
 * treated as a national natural key elsewhere in this schema (Member.idNumber
 * is globally unique), and a deceased person shouldn't be re-addable under a
 * different member's record either. Includes soft-deleted rows: a
 * soft-deleted DECEASED record still blocks re-registration.
 */
export async function assertNotReRegisteringDeceased(idNumber: string): Promise<void> {
  const deceased = await prisma.beneficiary.findFirst({
    where: { idNumber, status: "DECEASED" },
  });
  if (deceased) {
    throw new BeneficiaryRuleError(
      "A beneficiary with this ID number is already recorded as deceased and cannot be re-registered."
    );
  }
}
