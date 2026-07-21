import { NextRequest, NextResponse } from "next/server";
import { requireOwnMemberOrAdmin, UnauthorizedError, ForbiddenError } from "@/server/permissions";
import { generateContributionStatement } from "@/lib/reports/contributionStatement";
import { logAudit } from "@/lib/audit";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ memberId: string; year: string }> }) {
  const { memberId, year } = await params;
  const yearNum = Number(year);
  if (!Number.isInteger(yearNum)) return NextResponse.json({ error: "Invalid year" }, { status: 400 });

  let session;
  try {
    session = await requireOwnMemberOrAdmin(memberId);
  } catch (e) {
    if (e instanceof UnauthorizedError) return NextResponse.json({ error: e.message }, { status: 401 });
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 });
    throw e;
  }

  const pdf = await generateContributionStatement(memberId, yearNum);

  await logAudit({
    entityType: "Member",
    entityId: memberId,
    memberId,
    action: "VIEW_DOCUMENT",
    performedByUserId: session.user.id,
  });

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="contribution-statement-${memberId}-${yearNum}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
