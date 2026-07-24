import { NextRequest, NextResponse } from "next/server";
import { refreshAllAdminAccess } from "@/lib/business/adminAccess";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const count = await refreshAllAdminAccess();
  return NextResponse.json({ ok: true, adminsRevoked: count });
}
