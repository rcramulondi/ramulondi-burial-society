import { NextRequest, NextResponse } from "next/server";
import { refreshAllMemberStatuses } from "@/lib/business/memberStatus";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const count = await refreshAllMemberStatuses();
  return NextResponse.json({ ok: true, membersUpdated: count });
}
