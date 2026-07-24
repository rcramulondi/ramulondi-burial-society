-- CreateEnum
CREATE TYPE "AdminGroup" AS ENUM ('SUPER_ADMIN', 'TREASURER', 'SECRETARY', 'CHAIRPERSON');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "adminGroup" "AdminGroup",
ADD COLUMN     "disabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "disabledReason" TEXT;

