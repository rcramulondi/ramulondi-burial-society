import type { User } from "@prisma/client";

export type AccountStatus = "No account" | "Active" | "Locked" | "Disabled";

export function accountStatus(user: Pick<User, "disabled" | "lockedUntil"> | null): AccountStatus {
  if (!user) return "No account";
  if (user.disabled) return "Disabled";
  if (user.lockedUntil && user.lockedUntil > new Date()) return "Locked";
  return "Active";
}
