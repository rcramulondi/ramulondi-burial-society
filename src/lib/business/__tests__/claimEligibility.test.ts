import { describe, it, expect, vi, beforeEach } from "vitest";

const findUniqueOrThrowMember = vi.fn();
const findUniqueBeneficiary = vi.fn();
const findFirstClaim = vi.fn();
const findManyContributionRate = vi.fn().mockResolvedValue([]);
const findManyPaymentAllocation = vi.fn().mockResolvedValue([]);

vi.mock("../../prisma", () => ({
  prisma: {
    member: { findUniqueOrThrow: findUniqueOrThrowMember },
    beneficiary: { findUnique: findUniqueBeneficiary },
    claim: { findFirst: findFirstClaim },
    contributionRate: { findMany: findManyContributionRate },
    paymentAllocation: { findMany: findManyPaymentAllocation },
  },
}));
vi.mock("../../settings", () => ({
  getSetting: vi.fn().mockResolvedValue(6),
}));
vi.mock("../memberStatus", () => ({
  deriveMemberStatus: vi.fn().mockReturnValue({ status: "ACTIVE" }),
}));

const { checkClaimSubmissionEligibility } = await import("../claimEligibility");

const member = { id: "mem_1", status: "ACTIVE", dateJoined: new Date("2020-01-01"), reinstatementDate: null };

describe("checkClaimSubmissionEligibility — beneficiary status gating", () => {
  beforeEach(() => {
    findUniqueOrThrowMember.mockReset().mockResolvedValue(member);
    findUniqueBeneficiary.mockReset();
    findFirstClaim.mockReset().mockResolvedValue(null);
  });

  it("rejects a PENDING_APPROVAL beneficiary", async () => {
    findUniqueBeneficiary.mockResolvedValue({ id: "ben_1", memberId: "mem_1", status: "PENDING_APPROVAL" });

    const result = await checkClaimSubmissionEligibility("mem_1", { dateDeceased: new Date("2026-06-01"), beneficiaryId: "ben_1" });

    expect(result).toEqual({ eligible: false, reason: "This beneficiary has not been approved and is not eligible for a claim." });
  });

  it("rejects a REJECTED beneficiary", async () => {
    findUniqueBeneficiary.mockResolvedValue({ id: "ben_1", memberId: "mem_1", status: "REJECTED" });

    const result = await checkClaimSubmissionEligibility("mem_1", { dateDeceased: new Date("2026-06-01"), beneficiaryId: "ben_1" });

    expect(result).toEqual({ eligible: false, reason: "This beneficiary has not been approved and is not eligible for a claim." });
  });

  it("still rejects a DECEASED beneficiary (pre-existing behavior, unaffected)", async () => {
    findUniqueBeneficiary.mockResolvedValue({ id: "ben_1", memberId: "mem_1", status: "DECEASED" });

    const result = await checkClaimSubmissionEligibility("mem_1", { dateDeceased: new Date("2026-06-01"), beneficiaryId: "ben_1" });

    expect(result).toEqual({ eligible: false, reason: "This beneficiary is already recorded as deceased." });
  });

  it("still allows an INACTIVE beneficiary to be claimed against (regression guard — must not change)", async () => {
    findUniqueBeneficiary.mockResolvedValue({ id: "ben_1", memberId: "mem_1", status: "INACTIVE" });

    const result = await checkClaimSubmissionEligibility("mem_1", { dateDeceased: new Date("2026-06-01"), beneficiaryId: "ben_1" });

    expect(result).toEqual({ eligible: true });
  });
});
