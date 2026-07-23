-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "CommitteeRole" ADD VALUE 'VICE_SECRETARY';
ALTER TYPE "CommitteeRole" ADD VALUE 'ADDITIONAL_MEMBER_2';
ALTER TYPE "CommitteeRole" ADD VALUE 'YOUTH_COORDINATOR';

-- AlterTable
ALTER TABLE "Member" ADD COLUMN     "succeedsMemberId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Member_succeedsMemberId_key" ON "Member"("succeedsMemberId");

-- AddForeignKey
ALTER TABLE "Member" ADD CONSTRAINT "Member_succeedsMemberId_fkey" FOREIGN KEY ("succeedsMemberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

