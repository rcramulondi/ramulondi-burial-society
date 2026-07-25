import { describe, it, expect, vi, beforeEach } from "vitest";

const memberFindUniqueOrThrow = vi.fn();
const activationTokenCreate = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    member: { findUniqueOrThrow: memberFindUniqueOrThrow },
    activationToken: { create: activationTokenCreate },
  },
}));
vi.mock("@/server/permissions", () => ({
  requireAdmin: vi.fn().mockResolvedValue({ user: { id: "admin_1", role: "ADMIN" } }),
}));
vi.mock("@/lib/audit", () => ({ logAudit: vi.fn() }));
vi.mock("@/lib/actionError", () => ({
  toSafeErrorMessage: (_e: unknown, fallback: string) => fallback,
}));

const { inviteMember } = await import("../activation");

describe("inviteMember — inactive member guard", () => {
  beforeEach(() => {
    memberFindUniqueOrThrow.mockReset();
    activationTokenCreate.mockReset();
  });

  it("refuses to invite an IN_ACTIVE (lapsed) member", async () => {
    memberFindUniqueOrThrow.mockResolvedValue({ id: "mem_1", status: "IN_ACTIVE", user: null });

    const result = await inviteMember("mem_1");

    expect(result).toEqual({
      ok: false,
      error: "This member is inactive (lapsed) and must be reactivated before they can be granted access.",
    });
    expect(activationTokenCreate).not.toHaveBeenCalled();
  });
});
