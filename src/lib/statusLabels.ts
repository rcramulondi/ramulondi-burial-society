import type { MemberStatus, ClaimStatus } from "@prisma/client";

export const STATUS_LABELS: Record<MemberStatus, string> = {
  ACTIVE: "Active",
  ABOUT_TO_LAPSE: "About to lapse",
  IN_ACTIVE: "Lapsed / terminated",
  DECEASED: "Deceased",
};

export const CLAIM_STATUS_LABELS: Record<ClaimStatus, string> = {
  PENDING: "Pending review",
  APPROVED: "Approved — awaiting payout",
  REJECTED: "Rejected",
  PAID: "Paid",
};
