/**
 * One-off import of the single claim recorded on the workbook's
 * "Expenditure" sheet: David Ramulondi's burial payout to Portia Ramulondi.
 *
 * The sheet has no ID number / phone / bank details for the recipient, so
 * those required Claim fields are filled with clearly-marked placeholders —
 * this is a deliberate, explicitly-requested exception; update them via a
 * direct DB fix once the real KYC details are available.
 *
 * Usage: npx tsx scripts/import-claim-from-expenditure.ts
 */
import { prisma } from "../src/lib/prisma";
import { logAudit } from "../src/lib/audit";

const PLACEHOLDER_ID_NUMBER = "0000000000000";
const PLACEHOLDER_PHONE = "0000000000";
const PLACEHOLDER_BANK_NAME = "PLACEHOLDER — verify with recipient";
const PLACEHOLDER_ACCOUNT_NUMBER = "PLACEHOLDER — verify with recipient";

async function main() {
  const admin = await prisma.user.findFirstOrThrow({ where: { role: "ADMIN" } });

  const member = await prisma.member.findFirstOrThrow({
    where: { firstName: "David", surname: "Ramulondi" },
  });
  if (!member.deceasedDate) throw new Error("Expected David Ramulondi to already have a deceasedDate on file.");

  const existing = await prisma.claim.findFirst({ where: { memberId: member.id } });
  if (existing) {
    console.log(`Claim already exists for ${member.firstName} ${member.surname} (${existing.id}) — skipping, nothing imported.`);
    return;
  }

  const dateDeceased = member.deceasedDate;
  const paidDate = new Date(Date.UTC(2026, 1, 10)); // 10/02/2026, DD/MM/YYYY per sheet convention
  const amount = 21500;

  const claim = await prisma.claim.create({
    data: {
      memberId: member.id,
      dateDeceased,
      placeOfBurial: "KHALAVHA",
      payoutRecipientName: "Portia",
      payoutRecipientSurname: "Ramulondi",
      payoutRecipientIdNumber: PLACEHOLDER_ID_NUMBER,
      payoutRecipientPhone: PLACEHOLDER_PHONE,
      bankName: PLACEHOLDER_BANK_NAME,
      bankAccountNumber: PLACEHOLDER_ACCOUNT_NUMBER,
      status: "PAID",
      submittedByUserId: admin.id,
      submittedAt: paidDate,
      reviewedByUserId: admin.id,
      reviewedAt: paidDate,
      reviewNotes:
        "Imported from the source spreadsheet's Expenditure sheet (row 2). Approved by Treasurer per that sheet. " +
        "Recipient ID number, phone, and bank details are PLACEHOLDERS — the sheet did not capture them. " +
        "Verify and update with real KYC details before relying on this record for compliance/audit purposes.",
    },
  });

  const payout = await prisma.claimPayout.create({
    data: {
      claimId: claim.id,
      amount,
      paidDate,
      paidTo: "Portia Ramulondi",
      paidByUserId: admin.id,
      notes: "Imported from source spreadsheet (Expenditure sheet, row 2). Payment method: Transfer. Approved by Treasurer.",
    },
  });

  await logAudit({
    entityType: "Claim",
    entityId: claim.id,
    memberId: member.id,
    action: "CREATE",
    performedByUserId: admin.id,
    metadata: { source: "Expenditure sheet import", placeholderRecipientDetails: true },
  });
  await logAudit({
    entityType: "Claim",
    entityId: claim.id,
    memberId: member.id,
    action: "STATUS_CHANGE",
    performedByUserId: admin.id,
    metadata: { decision: "APPROVED", source: "Expenditure sheet import" },
  });
  await logAudit({
    entityType: "ClaimPayout",
    entityId: payout.id,
    memberId: member.id,
    action: "CREATE",
    performedByUserId: admin.id,
    metadata: { amount, paidTo: payout.paidTo, source: "Expenditure sheet import" },
  });

  console.log(`Created Claim ${claim.id} (status PAID) and ClaimPayout ${payout.id} for ${member.firstName} ${member.surname}.`);
  console.log(`Recipient details are placeholders — update payoutRecipientIdNumber/Phone/bankName/bankAccountNumber on Claim ${claim.id} once known.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
