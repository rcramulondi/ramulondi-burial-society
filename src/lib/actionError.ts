import { Prisma } from "@prisma/client";
import { UnauthorizedError, ForbiddenError } from "@/server/permissions";
import { BeneficiaryRuleError } from "./business/beneficiaryRules";
import { ClaimPayoutBlockedError } from "./business/claimEligibility";
import { UploadValidationError } from "./storage/blob";
import { MemberRuleError } from "./business/memberRules";

/** Error classes whose .message is written for end users and safe to show verbatim. */
const SAFE_ERROR_CLASSES = [
  UnauthorizedError,
  ForbiddenError,
  BeneficiaryRuleError,
  ClaimPayoutBlockedError,
  UploadValidationError,
  MemberRuleError,
];

/**
 * Converts a caught error into a message safe to return from a server action.
 * Only our own hand-written business-rule errors are shown verbatim; anything
 * else (Prisma internals, unexpected runtime errors) is logged server-side
 * and replaced with a generic message, so stack traces/file paths/query
 * details never leak to the browser.
 */
export function toSafeErrorMessage(e: unknown, fallback: string): string {
  if (SAFE_ERROR_CLASSES.some((cls) => e instanceof cls)) {
    return (e as Error).message;
  }

  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
    const target = (e.meta?.target as string[] | undefined)?.join(", ") ?? "a field";
    console.error("Unique constraint violation:", e.message);
    return `A record with the same ${target} already exists.`;
  }

  console.error(e);
  return fallback;
}
