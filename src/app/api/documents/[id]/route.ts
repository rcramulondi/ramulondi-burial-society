import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchPrivateFile } from "@/lib/storage/blob";
import { requireAuth } from "@/server/permissions";
import { logAudit } from "@/lib/audit";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth();
  const { id } = await params;

  const doc = await prisma.document.findUnique({
    where: { id },
    include: { member: true, beneficiary: { include: { member: true } }, claim: { include: { member: true } } },
  });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const ownerMemberId =
    doc.memberId ?? doc.beneficiary?.memberId ?? doc.claim?.memberId ?? null;

  const isOwner = session.user.role === "ADMIN" || (ownerMemberId && ownerMemberId === session.user.memberId);
  if (!isOwner) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const upstream = await fetchPrivateFile(doc.storageKey);
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: "File unavailable" }, { status: 502 });
  }

  await logAudit({
    entityType: "Document",
    entityId: doc.id,
    memberId: ownerMemberId,
    action: "VIEW_DOCUMENT",
    performedByUserId: session.user.id,
  });

  return new NextResponse(upstream.body, {
    headers: {
      "Content-Type": doc.mimeType,
      "Content-Disposition": `inline; filename="${doc.fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
