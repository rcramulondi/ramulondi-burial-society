import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwnMemberOrAdmin, UnauthorizedError, ForbiddenError } from "@/server/permissions";
import { generateProofOfPaymentPdf } from "@/lib/reports/proofOfPayment";
import { logAudit } from "@/lib/audit";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ paymentId: string }> }) {
  const { paymentId } = await params;

  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let session;
  try {
    session = await requireOwnMemberOrAdmin(payment.memberId);
  } catch (e) {
    if (e instanceof UnauthorizedError) return NextResponse.json({ error: e.message }, { status: 401 });
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 });
    throw e;
  }

  const pdf = await generateProofOfPaymentPdf(paymentId);

  await logAudit({
    entityType: "Payment",
    entityId: paymentId,
    memberId: payment.memberId,
    action: "VIEW_DOCUMENT",
    performedByUserId: session.user.id,
  });

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="proof-of-payment-${paymentId}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
