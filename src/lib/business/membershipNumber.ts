import { prisma } from "../prisma";

/**
 * Generates the next membership number for a surname, following the source
 * spreadsheet's own scheme: first 4 letters of the surname (upper-cased,
 * padded with "X" if shorter) + a zero-padded sequence number, e.g. "RAMU0001".
 * The sequence is scoped per prefix so different surnames don't collide.
 */
export async function generateMembershipNumber(surname: string): Promise<string> {
  const prefix = surname.trim().toUpperCase().replace(/[^A-Z]/g, "").padEnd(4, "X").slice(0, 4);

  const existing = await prisma.member.findMany({
    where: { membershipNo: { startsWith: prefix } },
    select: { membershipNo: true },
  });

  let maxSeq = 0;
  for (const { membershipNo } of existing) {
    const suffix = membershipNo.slice(prefix.length);
    const n = Number(suffix);
    if (Number.isInteger(n) && n > maxSeq) maxSeq = n;
  }

  const next = String(maxSeq + 1).padStart(4, "0");
  return `${prefix}${next}`;
}

/**
 * Generates the next beneficiary reference number for a member,
 * e.g. "RAMU0001-B01".
 */
export async function generateBeneficiaryReference(
  membershipNo: string,
  memberId: string
): Promise<string> {
  const count = await prisma.beneficiary.count({ where: { memberId } });
  const next = String(count + 1).padStart(2, "0");
  return `${membershipNo}-B${next}`;
}
