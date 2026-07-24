import "server-only";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Session } from "next-auth";
import type { AdminGroup } from "@prisma/client";

export class UnauthorizedError extends Error {
  constructor(message = "You must be signed in to do this.") {
    super(message);
  }
}

export class ForbiddenError extends Error {
  constructor(message = "You don't have permission to do this.") {
    super(message);
  }
}

/**
 * Every server action / route handler must call this before touching Prisma
 * — never trust edge routing alone. Re-fetches the User row on every call
 * (rather than trusting the JWT alone) so that admin-group changes and
 * account disablement/lockout take effect on the very next action, without
 * needing the caller to sign out and back in — the JWT would otherwise only
 * refresh at next sign-in. Cost is one extra indexed PK lookup per protected
 * call, negligible at this app's scale.
 */
export async function requireAuth(): Promise<Session> {
  const session = await auth();
  if (!session?.user) throw new UnauthorizedError();

  const dbUser = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!dbUser || dbUser.disabled || (dbUser.lockedUntil && dbUser.lockedUntil > new Date())) {
    throw new UnauthorizedError("Your account access has been revoked or is currently locked.");
  }

  session.user.role = dbUser.role;
  session.user.adminGroup = dbUser.adminGroup;
  session.user.memberId = dbUser.memberId;
  return session;
}

export async function requireAdmin(): Promise<Session> {
  const session = await requireAuth();
  if (session.user.role !== "ADMIN") throw new ForbiddenError("This action requires admin access.");
  return session;
}

/** Restricts an admin action to one or more specific admin groups (e.g. Treasurer-only). */
export async function requireAdminGroup(...groups: AdminGroup[]): Promise<Session> {
  const session = await requireAdmin();
  if (!session.user.adminGroup || !groups.includes(session.user.adminGroup)) {
    throw new ForbiddenError("You don't have permission to do this.");
  }
  return session;
}

/** Allows admins, or a member acting on their own record. */
export async function requireOwnMemberOrAdmin(memberId: string): Promise<Session> {
  const session = await requireAuth();
  if (session.user.role === "ADMIN") return session;
  if (session.user.memberId === memberId) return session;
  throw new ForbiddenError("You can only access your own membership record.");
}

/**
 * Full member-record maintenance (create/update Member, Beneficiary,
 * claim submission) — Super Admin/Secretary, or the member acting on their
 * own record. Unlike `requireOwnMemberOrAdmin`, this excludes Treasurer and
 * Chairperson-group admins from maintaining *other* members' records; they
 * can still view everything via the broader `requireAdmin()`-gated reads.
 */
export async function requireMemberMaintainer(memberId: string): Promise<Session> {
  const session = await requireAuth();
  if (session.user.role === "ADMIN" && (session.user.adminGroup === "SUPER_ADMIN" || session.user.adminGroup === "SECRETARY")) {
    return session;
  }
  if (session.user.memberId === memberId) return session;
  throw new ForbiddenError("You don't have permission to maintain this member's details.");
}
