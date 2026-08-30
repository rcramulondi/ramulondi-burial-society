import { describe, it, expect, vi, beforeEach } from "vitest";

const findUniqueOrThrowMember = vi.fn();
const findUniqueOrThrowBeneficiary = vi.fn();
const beneficiaryCreate = vi.fn();
const beneficiaryUpdate = vi.fn();
const beneficiaryCount = vi.fn();
const logAudit = vi.fn();
const sendBeneficiaryApprovalRequestEmail = vi.fn();
const sendBeneficiaryDecisionNotification = vi.fn();

let sessionUser: { id: string; role: string; adminGroup?: string | null };

vi.mock("@/lib/prisma", () => ({
  prisma: {
    member: { findUniqueOrThrow: findUniqueOrThrowMember },
    beneficiary: {
      findUniqueOrThrow: findUniqueOrThrowBeneficiary,
      create: beneficiaryCreate,
      update: beneficiaryUpdate,
      count: beneficiaryCount,
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}));
vi.mock("@/server/permissions", () => ({
  requireMemberMaintainer: vi.fn(async () => ({ user: sessionUser })),
  requireAdminGroup: vi.fn(async () => ({ user: sessionUser })),
  requireOwnMemberOrAdmin: vi.fn(async () => ({ user: sessionUser })),
  requireAdmin: vi.fn(async () => ({ user: sessionUser })),
}));
vi.mock("@/lib/business/beneficiaryRules", () => ({
  assertSingleParentSlotAvailable: vi.fn(),
  assertDeletionAllowed: vi.fn(),
  assertNotReRegisteringDeceased: vi.fn(),
}));
vi.mock("@/lib/business/membershipNumber", () => ({
  generateBeneficiaryReference: vi.fn().mockResolvedValue("RAMU0001-B1"),
}));
vi.mock("../notifications", () => ({
  sendBeneficiaryApprovalRequestEmail,
  sendBeneficiaryDecisionNotification,
}));
vi.mock("@/lib/audit", () => ({ logAudit }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/actionError", () => ({
  toSafeErrorMessage: (_e: unknown, fallback: string) => fallback,
}));

const {
  createBeneficiary,
  applyBeneficiaryStatusTransition,
  reviewBeneficiary,
  cancelBeneficiary,
} = await import("../beneficiary");

const baseCreateInput = {
  memberId: "mem_1",
  firstName: "John",
  surname: "Doe",
  idNumber: "8001015009087",
  relationship: "SON" as const,
};

describe("createBeneficiary — submission workflow branching", () => {
  beforeEach(() => {
    findUniqueOrThrowMember.mockReset().mockResolvedValue({ id: "mem_1", status: "ACTIVE", membershipNo: "RAMU0001" });
    beneficiaryCreate.mockReset().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve({ id: "ben_1", ...data })
    );
    logAudit.mockReset();
    sendBeneficiaryApprovalRequestEmail.mockReset();
    sendBeneficiaryDecisionNotification.mockReset();
  });

  it("creates a PENDING_APPROVAL beneficiary and emails admins/committee when submitted by a member", async () => {
    sessionUser = { id: "user_member", role: "MEMBER" };

    const result = await createBeneficiary(baseCreateInput);

    expect(result.ok).toBe(true);
    expect(beneficiaryCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "PENDING_APPROVAL", submittedByUserId: "user_member" }),
      })
    );
    expect(sendBeneficiaryApprovalRequestEmail).toHaveBeenCalledTimes(1);
    expect(sendBeneficiaryDecisionNotification).not.toHaveBeenCalled();
  });

  it("auto-approves and activates immediately when submitted by an Administrator", async () => {
    sessionUser = { id: "user_admin", role: "ADMIN", adminGroup: "SECRETARY" };

    const result = await createBeneficiary(baseCreateInput);

    expect(result.ok).toBe(true);
    expect(beneficiaryCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "ACTIVE",
          submittedByUserId: "user_admin",
          reviewedByUserId: "user_admin",
        }),
      })
    );
    expect(sendBeneficiaryDecisionNotification).toHaveBeenCalledTimes(1);
    expect(sendBeneficiaryApprovalRequestEmail).not.toHaveBeenCalled();
  });
});

describe("applyBeneficiaryStatusTransition — approval-workflow guards", () => {
  beforeEach(() => {
    findUniqueOrThrowBeneficiary.mockReset();
    beneficiaryUpdate.mockReset();
    logAudit.mockReset();
  });

  it("blocks any transition out of PENDING_APPROVAL via the generic transition path", async () => {
    findUniqueOrThrowBeneficiary.mockResolvedValue({ id: "ben_1", memberId: "mem_1", status: "PENDING_APPROVAL" });

    const result = await applyBeneficiaryStatusTransition("ben_1", "ACTIVE", "user_1");

    expect(result.ok).toBe(false);
    expect(beneficiaryUpdate).not.toHaveBeenCalled();
  });

  it("blocks setting PENDING_APPROVAL or REJECTED through the generic transition path", async () => {
    findUniqueOrThrowBeneficiary.mockResolvedValue({ id: "ben_1", memberId: "mem_1", status: "ACTIVE" });

    const result = await applyBeneficiaryStatusTransition("ben_1", "REJECTED", "user_1");

    expect(result.ok).toBe(false);
    expect(beneficiaryUpdate).not.toHaveBeenCalled();
  });

  it("still allows the pre-existing ACTIVE -> DECEASED transition (claim approval's call site)", async () => {
    findUniqueOrThrowBeneficiary.mockResolvedValue({ id: "ben_1", memberId: "mem_1", status: "ACTIVE" });

    const result = await applyBeneficiaryStatusTransition("ben_1", "DECEASED", "user_1");

    expect(result.ok).toBe(true);
    expect(beneficiaryUpdate).toHaveBeenCalledTimes(1);
  });
});

describe("reviewBeneficiary — decisive approve/reject action", () => {
  beforeEach(() => {
    sessionUser = { id: "secretary_1", role: "ADMIN", adminGroup: "SECRETARY" };
    findUniqueOrThrowBeneficiary.mockReset().mockResolvedValue({ id: "ben_1", memberId: "mem_1", status: "PENDING_APPROVAL" });
    beneficiaryUpdate.mockReset().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve({ id: "ben_1", memberId: "mem_1", ...data })
    );
    logAudit.mockReset();
    sendBeneficiaryDecisionNotification.mockReset();
  });

  it("requires a reason when rejecting", async () => {
    const result = await reviewBeneficiary({ beneficiaryId: "ben_1", decision: "REJECTED" });

    expect(result.ok).toBe(false);
    expect(beneficiaryUpdate).not.toHaveBeenCalled();
  });

  it("approves and flips status to ACTIVE when a reason isn't required", async () => {
    const result = await reviewBeneficiary({ beneficiaryId: "ben_1", decision: "APPROVED" });

    expect(result.ok).toBe(true);
    expect(beneficiaryUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "ACTIVE", reviewedByUserId: "secretary_1" }) })
    );
    expect(sendBeneficiaryDecisionNotification).toHaveBeenCalledTimes(1);
  });

  it("rejects with a reason and flips status to REJECTED", async () => {
    const result = await reviewBeneficiary({ beneficiaryId: "ben_1", decision: "REJECTED", reviewNotes: "ID number did not match records." });

    expect(result.ok).toBe(true);
    expect(beneficiaryUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "REJECTED", reviewNotes: "ID number did not match records." }) })
    );
  });

  it("refuses to act on a beneficiary that isn't PENDING_APPROVAL", async () => {
    findUniqueOrThrowBeneficiary.mockResolvedValue({ id: "ben_1", memberId: "mem_1", status: "ACTIVE" });

    const result = await reviewBeneficiary({ beneficiaryId: "ben_1", decision: "APPROVED" });

    expect(result.ok).toBe(false);
    expect(beneficiaryUpdate).not.toHaveBeenCalled();
  });
});

describe("cancelBeneficiary — member self-service withdrawal", () => {
  beforeEach(() => {
    sessionUser = { id: "user_member", role: "MEMBER" };
    findUniqueOrThrowBeneficiary.mockReset();
    beneficiaryUpdate.mockReset().mockResolvedValue({});
    logAudit.mockReset();
  });

  it("logs STATUS_CHANGE, not DELETE, so it never consumes the 12-month deletion allowance", async () => {
    findUniqueOrThrowBeneficiary.mockResolvedValue({ id: "ben_1", memberId: "mem_1", status: "PENDING_APPROVAL" });

    const result = await cancelBeneficiary("ben_1");

    expect(result.ok).toBe(true);
    expect(logAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "STATUS_CHANGE" }));
    expect(logAudit).not.toHaveBeenCalledWith(expect.objectContaining({ action: "DELETE" }));
  });

  it("refuses to cancel a beneficiary that's already ACTIVE", async () => {
    findUniqueOrThrowBeneficiary.mockResolvedValue({ id: "ben_1", memberId: "mem_1", status: "ACTIVE" });

    const result = await cancelBeneficiary("ben_1");

    expect(result.ok).toBe(false);
    expect(beneficiaryUpdate).not.toHaveBeenCalled();
  });
});
