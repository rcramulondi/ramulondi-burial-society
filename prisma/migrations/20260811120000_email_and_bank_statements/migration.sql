-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'EMAIL_SENT';

-- AlterEnum
ALTER TYPE "DocumentOwner" ADD VALUE 'BANK_STATEMENT';

-- CreateEnum
CREATE TYPE "BankAccountType" AS ENUM ('OPERATING', 'SAVINGS');

-- CreateEnum
CREATE TYPE "BankTransactionCategory" AS ENUM ('CONTRIBUTION_MATCHED', 'CONTRIBUTION_UNMATCHED', 'TRANSFER_IN', 'TRANSFER_OUT', 'INTEREST', 'BANK_FEE', 'EXPENSE_PENDING', 'EXPENSE_LINKED');

-- CreateTable
CREATE TABLE "BankStatementImport" (
    "id" TEXT NOT NULL,
    "accountType" "BankAccountType" NOT NULL,
    "fileName" TEXT NOT NULL,
    "closingBalance" DECIMAL(12,2) NOT NULL,
    "transactionCount" INTEGER NOT NULL,
    "importedByUserId" TEXT NOT NULL,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BankStatementImport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BankStatementImport_accountType_importedAt_idx" ON "BankStatementImport"("accountType", "importedAt");

-- CreateTable
CREATE TABLE "BankTransaction" (
    "id" TEXT NOT NULL,
    "importId" TEXT NOT NULL,
    "accountType" "BankAccountType" NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "balance" DECIMAL(12,2) NOT NULL,
    "category" "BankTransactionCategory" NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "memberId" TEXT,
    "paymentId" TEXT,
    "unallocatedFundId" TEXT,
    "expenseId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BankTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BankTransaction_fingerprint_key" ON "BankTransaction"("fingerprint");

-- CreateIndex
CREATE INDEX "BankTransaction_importId_idx" ON "BankTransaction"("importId");

-- CreateIndex
CREATE INDEX "BankTransaction_accountType_date_idx" ON "BankTransaction"("accountType", "date");

-- CreateIndex
CREATE INDEX "BankTransaction_category_idx" ON "BankTransaction"("category");

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "bankStatementImportId" TEXT;

-- CreateIndex
CREATE INDEX "Document_bankStatementImportId_idx" ON "Document"("bankStatementImportId");

-- AddForeignKey
ALTER TABLE "BankTransaction" ADD CONSTRAINT "BankTransaction_importId_fkey" FOREIGN KEY ("importId") REFERENCES "BankStatementImport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankTransaction" ADD CONSTRAINT "BankTransaction_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_bankStatementImportId_fkey" FOREIGN KEY ("bankStatementImportId") REFERENCES "BankStatementImport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
