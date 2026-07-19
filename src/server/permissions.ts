import "server-only";
import { auth } from "@/lib/auth";
import type { Session } from "next-auth";

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

/** Every server action / route handler must call this before touching Prisma — never trust edge routing alone. */
export async function requireAuth(): Promise<Session> {
  const session = await auth();
  if (!session?.user) throw new UnauthorizedError();
  return session;
}

export async function requireAdmin(): Promise<Session> {
  const session = await requireAuth();
  if (session.user.role !== "ADMIN") throw new ForbiddenError("This action requires admin access.");
  return session;
}

/** Allows admins, or a member acting on their own record. */
export async function requireOwnMemberOrAdmin(memberId: string): Promise<Session> {
  const session = await requireAuth();
  if (session.user.role === "ADMIN") return session;
  if (session.user.memberId === memberId) return session;
  throw new ForbiddenError("You can only access your own membership record.");
}
