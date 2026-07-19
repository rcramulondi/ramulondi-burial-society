import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

// Edge-level route gating for UX only (fast redirects). This is defense in
// depth, not the source of truth — every server action/route independently
// re-checks role/ownership via src/server/permissions.ts before touching
// Prisma, since middleware can be bypassed by calling a route directly.
export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isAuthed = !!req.auth?.user;
  const isAdmin = req.auth?.user?.role === "ADMIN";

  if (pathname.startsWith("/admin")) {
    if (!isAuthed) return NextResponse.redirect(new URL("/login", req.url));
    if (!isAdmin) return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  const memberOnlyPrefixes = ["/dashboard", "/beneficiaries", "/contributions", "/claims", "/profile"];
  if (memberOnlyPrefixes.some((p) => pathname.startsWith(p)) && !isAuthed) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/admin/:path*", "/dashboard/:path*", "/beneficiaries/:path*", "/contributions/:path*", "/claims/:path*", "/profile/:path*"],
};
