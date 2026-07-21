import type { MemberStatus, ClaimStatus, BeneficiaryStatus, CommitteeRole } from "@prisma/client";

export const STATUS_LABELS: Record<MemberStatus, string> = {
  ACTIVE: "Active",
  ABOUT_TO_LAPSE: "About to lapse",
  IN_ACTIVE: "Lapsed / terminated",
  DECEASED: "Deceased",
};

export const BENEFICIARY_STATUS_LABELS: Record<BeneficiaryStatus, string> = {
  ACTIVE: "Active",
  INACTIVE: "Inactive",
  DECEASED: "Deceased",
};

export const CLAIM_STATUS_LABELS: Record<ClaimStatus, string> = {
  PENDING: "Pending review",
  APPROVED: "Approved — awaiting payout",
  REJECTED: "Rejected",
  PAID: "Paid",
};

export const COMMITTEE_ROLE_LABELS: Record<CommitteeRole, string> = {
  CHAIRPERSON: "Chairperson",
  VICE_CHAIR: "Vice-Chair",
  SECRETARY: "Secretary",
  TREASURER: "Treasurer",
  ADDITIONAL_MEMBER: "Additional Member",
};

export const COMMITTEE_ROLE_ORDER: CommitteeRole[] = [
  "CHAIRPERSON",
  "VICE_CHAIR",
  "SECRETARY",
  "TREASURER",
  "ADDITIONAL_MEMBER",
];
