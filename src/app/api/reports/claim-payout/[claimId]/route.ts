import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwnMemberOrAdmin, UnauthorizedError, ForbiddenError } from "@/server/permissions";
import { generateClaimPayoutProofPdf } from "@/lib/reports/claimPayoutProof";
import { logAudit } from "@/lib/audit";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ claimId: string }> }) {
  const { claimId } = await params;

  const claim = await prisma.claim.findUnique({ where: { id: claimId }, include: { payout: true } });
  if (!claim) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!claim.payout) return NextResponse.json({ error: "No payout has been recorded for this claim yet." }, { status: 404 });

  let session;
  try {
    session = await requireOwnMemberOrAdmin(claim.memberId);
  } catch (e) {
    if (e instanceof UnauthorizedError) return NextResponse.json({ error: e.message }, { status: 401 });
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 });
    throw e;
  }

  const pdf = await generateClaimPayoutProofPdf(claimId);

  await logAudit({
    entityType: "Claim",
    entityId: claimId,
    memberId: claim.memberId,
    action: "VIEW_DOCUMENT",
    performedByUserId: session.user.id,
  });

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="claim-payout-proof-${claimId}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
