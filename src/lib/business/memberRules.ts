import { prisma } from "../prisma";

export class MemberRuleError extends Error {}

/**
 * A spouse/partner taking over a deceased member's policy is registered as
 * an entirely fresh, independent Member record — this just validates the
 * chosen "succeeds" target is a real deceased member with no successor yet.
 * The real constraint is the DB-level @unique on Member.succeedsMemberId;
 * this is the friendly pre-check, same relationship as
 * assertSingleParentSlotAvailable ↔ the FATHER/MOTHER partial unique index.
 */
export async function assertSuccessionTarget(succeedsMemberId: string): Promise<void> {
  const target = await prisma.member.findUnique({
    where: { id: succeedsMemberId },
    include: { succeededByMember: true },
  });
  if (!target) {
    throw new MemberRuleError("The member being succeeded could not be found.");
  }
  if (target.status !== "DECEASED") {
    throw new MemberRuleError("Succession can only be recorded against a member marked as deceased.");
  }
  if (target.succeededByMember) {
    throw new MemberRuleError(
      `${target.firstName} ${target.surname} (${target.membershipNo}) already has a successor recorded.`
    );
  }
}
