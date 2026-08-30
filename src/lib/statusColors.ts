import type { MemberStatus, BeneficiaryStatus } from "@prisma/client";

export type StatusColor = "green" | "amber" | "red" | "grey";

export const MEMBER_STATUS_COLORS: Record<MemberStatus, StatusColor> = {
  ACTIVE: "green",
  ABOUT_TO_LAPSE: "amber",
  IN_ACTIVE: "red",
  DECEASED: "grey",
};

export const BENEFICIARY_STATUS_COLORS: Record<BeneficiaryStatus, StatusColor> = {
  ACTIVE: "green",
  INACTIVE: "red",
  DECEASED: "grey",
  PENDING_APPROVAL: "amber",
  REJECTED: "red",
};

// Industry is a mono (steel-blue) palette — no red/amber/green hues. Status is
// distinguished by weight/fill instead of hue: filled accent tag = good
// standing, outline tag = needs attention, neutral tag = inactive/closed.
export const STATUS_COLOR_CLASSES: Record<StatusColor, string> = {
  green: "text-white bg-accent border-accent",             // Active — filled, solid
  amber: "text-navy bg-transparent border-accent",           // About to lapse — outline
  red: "text-navy bg-transparent border-navy/40",            // Lapsed/terminated — dim outline
  grey: "text-navy/60 bg-neutral-100 border-transparent",     // Deceased/inactive — flat neutral
};

export function outstandingBalanceClass(amount: number): string {
  return amount > 0 ? "font-bold text-navy" : "";
}
