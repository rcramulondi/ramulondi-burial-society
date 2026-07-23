import { describe, it, expect, vi, beforeEach } from "vitest";

const findUniqueOrThrow = vi.fn();
const recordPaymentWithAllocation = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: { member: { findUniqueOrThrow } },
}));
vi.mock("@/lib/business/contributionAllocation", () => ({
  recordPaymentWithAllocation,
  getOutstandingBalance: vi.fn(),
}));
vi.mock("@/server/permissions", () => ({
  requireAdmin: vi.fn().mockResolvedValue({ user: { id: "admin_1", role: "ADMIN" } }),
  requireOwnMemberOrAdmin: vi.fn(),
}));
vi.mock("@/lib/audit", () => ({ logAudit: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/actionError", () => ({
  toSafeErrorMessage: (_e: unknown, fallback: string) => fallback,
}));

const { recordPayment } = await import("../payment");

describe("recordPayment — deceased member lock", () => {
  beforeEach(() => {
    findUniqueOrThrow.mockReset();
    recordPaymentWithAllocation.mockReset();
  });

  it("rejects recording a payment against a DECEASED member without ever calling recordPaymentWithAllocation", async () => {
    findUniqueOrThrow.mockResolvedValue({ id: "mem_1", status: "DECEASED" });

    const result = await recordPayment({
      memberId: "mem_1",
      category: "MONTHLY_CONTRIBUTION",
      amount: 80,
      paymentDate: new Date("2026-01-15"),
    });

    expect(result).toEqual({
      ok: false,
      error: "This member is recorded as deceased and payments can no longer be recorded against their record.",
    });
    expect(recordPaymentWithAllocation).not.toHaveBeenCalled();
  });

  it("allows recording a payment for a non-deceased member", async () => {
    findUniqueOrThrow.mockResolvedValue({ id: "mem_2", status: "ACTIVE" });
    recordPaymentWithAllocation.mockResolvedValue({ paymentId: "pay_1", unallocatedAmount: 0 });

    const result = await recordPayment({
      memberId: "mem_2",
      category: "MONTHLY_CONTRIBUTION",
      amount: 80,
      paymentDate: new Date("2026-01-15"),
    });

    expect(result.ok).toBe(true);
    expect(recordPaymentWithAllocation).toHaveBeenCalledTimes(1);
  });
});
