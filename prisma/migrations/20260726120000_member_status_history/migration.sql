-- CreateTable
CREATE TABLE "MemberStatusHistory" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "status" "MemberStatus" NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemberStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MemberStatusHistory_memberId_changedAt_idx" ON "MemberStatusHistory"("memberId", "changedAt");

-- AddForeignKey
ALTER TABLE "MemberStatusHistory" ADD CONSTRAINT "MemberStatusHistory_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

