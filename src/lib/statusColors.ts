import type { MemberStatus, BeneficiaryStatus } from "@prisma/client";

export type StatusColor = "green" | "amber" | "red" | "grey";

export const MEMBER_STATUS_COLORS: Record<MemberStatus, StatusColor> = {
  ACTIVE: "green",
  ABOUT_TO_LAPSE: "amber",
  IN_ACTIVE: "red",
  DECEASED: "grey",
};

// Beneficiaries have no "trending toward lapsing" state, so INACTIVE maps to
// red (closer to a member's terminated/lapsed state) rather than amber.
export const BENEFICIARY_STATUS_COLORS: Record<BeneficiaryStatus, StatusColor> = {
  ACTIVE: "green",
  INACTIVE: "red",
  DECEASED: "grey",
};

export const STATUS_COLOR_CLASSES: Record<StatusColor, string> = {
  green: "text-green-700 bg-green-50 border-green-200",
  amber: "text-amber-700 bg-amber-50 border-amber-200",
  red: "text-red-700 bg-red-50 border-red-200",
  grey: "text-slate-500 bg-slate-100 border-slate-200",
};

export function outstandingBalanceClass(amount: number): string {
  return amount > 0 ? "font-bold text-red-700" : "";
}
