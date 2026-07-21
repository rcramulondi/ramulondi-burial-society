/**
 * Wipes all operational data (members, payments, allocations, rates,
 * beneficiaries, claims, documents, audit log) so the database can be
 * reimported from a fresh spreadsheet via import-xlsx.ts. Does NOT touch
 * User or ActivationToken rows — logins are preserved; a User's memberId
 * link is cleared automatically (ON DELETE SET NULL) when its member is
 * deleted.
 *
 * Usage: npx tsx scripts/reset-data.ts
 */
import { prisma } from "../src/lib/prisma";

async function main() {
  console.log("Deleting in FK-safe order...");

  const document = await prisma.document.deleteMany({});
  console.log(`  Document: ${document.count}`);

  const auditLog = await prisma.auditLog.deleteMany({});
  console.log(`  AuditLog: ${auditLog.count}`);

  const paymentAllocation = await prisma.paymentAllocation.deleteMany({});
  console.log(`  PaymentAllocation: ${paymentAllocation.count}`);

  const claimPayout = await prisma.claimPayout.deleteMany({});
  console.log(`  ClaimPayout: ${claimPayout.count}`);

  const claim = await prisma.claim.deleteMany({});
  console.log(`  Claim: ${claim.count}`);

  const payment = await prisma.payment.deleteMany({});
  console.log(`  Payment: ${payment.count}`);

  const beneficiary = await prisma.beneficiary.deleteMany({});
  console.log(`  Beneficiary: ${beneficiary.count}`);

  const payoutNominee = await prisma.payoutNominee.deleteMany({});
  console.log(`  PayoutNominee: ${payoutNominee.count}`);

  const member = await prisma.member.deleteMany({});
  console.log(`  Member: ${member.count}`);

  const contributionRate = await prisma.contributionRate.deleteMany({});
  console.log(`  ContributionRate: ${contributionRate.count}`);

  console.log("\nReset complete. User accounts and activation tokens were left untouched.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
