import { prisma } from "../prisma";

export class CommitteeRuleError extends Error {}

/**
 * Only active (or about-to-lapse) members can be assigned to a committee
 * position — a lapsed/deceased member shouldn't hold office.
 */
export async function assertMemberEligibleForCommittee(memberId: string): Promise<void> {
  const member = await prisma.member.findUniqueOrThrow({ where: { id: memberId } });
  if (member.status !== "ACTIVE" && member.status !== "ABOUT_TO_LAPSE") {
    throw new CommitteeRuleError(
      "Only active members (or members about to lapse) can be assigned to a committee position."
    );
  }
}
