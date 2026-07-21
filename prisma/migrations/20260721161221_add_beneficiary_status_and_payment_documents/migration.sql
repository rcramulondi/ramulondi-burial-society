-- CreateEnum
CREATE TYPE "BeneficiaryStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'DECEASED');

-- AlterEnum
ALTER TYPE "DocumentOwner" ADD VALUE 'PAYMENT_PROOF';

-- AlterTable
ALTER TABLE "Beneficiary" ADD COLUMN     "status" "BeneficiaryStatus" NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "paymentId" TEXT;

-- CreateIndex
CREATE INDEX "Document_paymentId_idx" ON "Document"("paymentId");

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
