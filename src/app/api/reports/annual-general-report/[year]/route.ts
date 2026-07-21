import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, UnauthorizedError, ForbiddenError } from "@/server/permissions";
import { generateAnnualGeneralReport } from "@/lib/reports/annualGeneralReport";
import { logAudit } from "@/lib/audit";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ year: string }> }) {
  const { year } = await params;
  const yearNum = Number(year);
  if (!Number.isInteger(yearNum)) return NextResponse.json({ error: "Invalid year" }, { status: 400 });

  let session;
  try {
    session = await requireAdmin();
  } catch (e) {
    if (e instanceof UnauthorizedError) return NextResponse.json({ error: e.message }, { status: 401 });
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 });
    throw e;
  }

  const pdf = await generateAnnualGeneralReport(yearNum);

  await logAudit({
    entityType: "AnnualGeneralReport",
    entityId: String(yearNum),
    action: "VIEW_DOCUMENT",
    performedByUserId: session.user.id,
  });

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="annual-general-report-${yearNum}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
