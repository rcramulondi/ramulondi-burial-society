-- CreateEnum
CREATE TYPE "CommitteeRole" AS ENUM ('CHAIRPERSON', 'VICE_CHAIR', 'SECRETARY', 'TREASURER', 'ADDITIONAL_MEMBER');

-- CreateEnum
CREATE TYPE "BurialSite" AS ENUM ('KHALAVHA', 'OTHER');

-- CreateEnum
CREATE TYPE "ClaimRateType" AS ENUM ('BASE_PAYOUT', 'ADDITIONAL_BURIAL_SITE');

-- CreateEnum
CREATE TYPE "DepositType" AS ENUM ('CASH', 'EFT');

-- AlterEnum
ALTER TYPE "DocumentOwner" ADD VALUE 'EXPENSE_PROOF';

-- DropIndex
DROP INDEX "Claim_memberId_key";

-- AlterTable
ALTER TABLE "Claim" ADD COLUMN     "beneficiaryId" TEXT,
ADD COLUMN     "placeOfBurial" "BurialSite" NOT NULL DEFAULT 'KHALAVHA';

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "expenseId" TEXT;

-- CreateTable
CREATE TABLE "CommitteeTerm" (
    "id" TEXT NOT NULL,
    "role" "CommitteeRole" NOT NULL,
    "memberId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommitteeTerm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClaimRate" (
    "id" TEXT NOT NULL,
    "type" "ClaimRateType" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClaimRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "expenseDate" TIMESTAMP(3) NOT NULL,
    "spentByMemberId" TEXT NOT NULL,
    "approvedByRole" "CommitteeRole" NOT NULL,
    "approvedByUserId" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnallocatedFund" (
    "id" TEXT NOT NULL,
    "depositType" "DepositType" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "depositDate" TIMESTAMP(3) NOT NULL,
    "reference" TEXT,
    "notes" TEXT,
    "recordedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UnallocatedFund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnallocatedFundAllocation" (
    "id" TEXT NOT NULL,
    "unallocatedFundId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "paymentId" TEXT,
    "allocatedByUserId" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UnallocatedFundAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CommitteeTerm_memberId_idx" ON "CommitteeTerm"("memberId");

-- CreateIndex
CREATE INDEX "CommitteeTerm_role_idx" ON "CommitteeTerm"("role");

-- CreateIndex
CREATE INDEX "ClaimRate_type_effectiveFrom_idx" ON "ClaimRate"("type", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "ClaimRate_type_effectiveFrom_key" ON "ClaimRate"("type", "effectiveFrom");

-- CreateIndex
CREATE INDEX "Expense_expenseDate_idx" ON "Expense"("expenseDate");

-- CreateIndex
CREATE INDEX "Expense_spentByMemberId_idx" ON "Expense"("spentByMemberId");

-- CreateIndex
CREATE INDEX "UnallocatedFund_depositDate_idx" ON "UnallocatedFund"("depositDate");

-- CreateIndex
CREATE INDEX "UnallocatedFundAllocation_memberId_idx" ON "UnallocatedFundAllocation"("memberId");

-- CreateIndex
CREATE INDEX "UnallocatedFundAllocation_unallocatedFundId_idx" ON "UnallocatedFundAllocation"("unallocatedFundId");

-- CreateIndex
CREATE INDEX "Claim_memberId_idx" ON "Claim"("memberId");

-- CreateIndex
CREATE INDEX "Claim_beneficiaryId_idx" ON "Claim"("beneficiaryId");

-- CreateIndex
CREATE INDEX "Document_expenseId_idx" ON "Document"("expenseId");

-- AddForeignKey
ALTER TABLE "CommitteeTerm" ADD CONSTRAINT "CommitteeTerm_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_beneficiaryId_fkey" FOREIGN KEY ("beneficiaryId") REFERENCES "Beneficiary"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_spentByMemberId_fkey" FOREIGN KEY ("spentByMemberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnallocatedFundAllocation" ADD CONSTRAINT "UnallocatedFundAllocation_unallocatedFundId_fkey" FOREIGN KEY ("unallocatedFundId") REFERENCES "UnallocatedFund"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnallocatedFundAllocation" ADD CONSTRAINT "UnallocatedFundAllocation_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnallocatedFundAllocation" ADD CONSTRAINT "UnallocatedFundAllocation_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Enforces "at most one active holder per committee role at a time" at the
-- database level (source of truth under concurrent writes). The application
-- layer also checks this pre-emptively — see src/lib/business/committeeRules.ts.
CREATE UNIQUE INDEX "uniq_active_committee_role" ON "CommitteeTerm" ("role")
  WHERE "endDate" IS NULL;

-- Enforces "at most one claim per member" and "at most one claim per
-- beneficiary" as two separate partial unique indexes, since a plain
-- composite unique on (memberId, beneficiaryId) wouldn't work: Postgres
-- treats NULL as distinct in unique indexes, so member-claims (beneficiaryId
-- IS NULL) would never collide with each other under a naive composite key.
-- Mirrors the FATHER/MOTHER-per-member pattern in
-- 20260719150256_beneficiary_partial_unique_indexes/migration.sql. The
-- application layer also checks this pre-emptively — see
-- src/lib/business/claimEligibility.ts.
CREATE UNIQUE INDEX "uniq_claim_per_member" ON "Claim" ("memberId")
  WHERE "beneficiaryId" IS NULL;

CREATE UNIQUE INDEX "uniq_claim_per_beneficiary" ON "Claim" ("beneficiaryId")
  WHERE "beneficiaryId" IS NOT NULL;
