import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";

// Best-effort, per-instance IP rate limit on login submissions — not a
// substitute for a distributed limiter (this Map isn't shared across
// serverless instances), but it meaningfully raises the cost of a scripted
// credential-spray attack against the login form, which is otherwise the
// one pre-auth endpoint in this app that does real DB + bcrypt work per
// request. Per-account brute force is already covered separately by the
// failedLoginCount/lockedUntil lockout in src/lib/auth.ts.
const LOGIN_RATE_LIMIT = 10;
const LOGIN_RATE_WINDOW_MS = 5 * 60 * 1000;
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

function isLoginRateLimited(ip: string): boolean {
  const now = Date.now();
  // Crude unbounded-growth guard — fine at this app's traffic scale.
  if (loginAttempts.size > 5000) loginAttempts.clear();

  const bucket = loginAttempts.get(ip);
  if (!bucket || bucket.resetAt < now) {
    loginAttempts.set(ip, { count: 1, resetAt: now + LOGIN_RATE_WINDOW_MS });
    return false;
  }
  bucket.count += 1;
  return bucket.count > LOGIN_RATE_LIMIT;
}

function getClientIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

// Edge-level route gating for UX only (fast redirects). This is defense in
// depth, not the source of truth — every server action/route independently
// re-checks role/ownership via src/server/permissions.ts before touching
// Prisma, since middleware can be bypassed by calling a route directly.
export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isAuthed = !!req.auth?.user;
  const isAdmin = req.auth?.user?.role === "ADMIN";

  if (pathname === "/login" && req.method === "POST") {
    if (isLoginRateLimited(getClientIp(req))) {
      return NextResponse.redirect(
        new URL(`/login?error=${encodeURIComponent("Too many sign-in attempts. Please wait a few minutes and try again.")}`, req.url)
      );
    }
  }

  if (pathname.startsWith("/admin")) {
    if (!isAuthed) return NextResponse.redirect(new URL("/login", req.url));
    if (!isAdmin) return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  const memberOnlyPrefixes = ["/dashboard", "/beneficiaries", "/contributions", "/claims", "/profile", "/meetings"];
  if (memberOnlyPrefixes.some((p) => pathname.startsWith(p)) && !isAuthed) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/login",
    "/admin/:path*",
    "/dashboard/:path*",
    "/beneficiaries/:path*",
    "/contributions/:path*",
    "/claims/:path*",
    "/profile/:path*",
    "/meetings/:path*",
  ],
};
