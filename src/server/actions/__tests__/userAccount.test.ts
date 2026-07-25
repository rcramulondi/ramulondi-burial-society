import { describe, it, expect, vi, beforeEach } from "vitest";

const userFindUniqueOrThrow = vi.fn();
const userCount = vi.fn();
const userUpdate = vi.fn();
const memberFindUniqueOrThrow = vi.fn();
const memberUpdate = vi.fn();
const refreshMemberStatus = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUniqueOrThrow: userFindUniqueOrThrow, count: userCount, update: userUpdate },
    member: { findUniqueOrThrow: memberFindUniqueOrThrow, update: memberUpdate },
  },
}));
vi.mock("@/server/permissions", () => ({
  requireAdminGroup: vi.fn().mockResolvedValue({ user: { id: "super_1", role: "ADMIN", adminGroup: "SUPER_ADMIN" } }),
}));
vi.mock("@/lib/audit", () => ({ logAudit: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/actionError", () => ({
  toSafeErrorMessage: (_e: unknown, fallback: string) => fallback,
}));
vi.mock("@/lib/business/memberStatus", () => ({ refreshMemberStatus }));

const { revokeAdminAccess, reactivateMember } = await import("../userAccount");
const { accountStatus } = await import("@/lib/accountStatus");

describe("revokeAdminAccess — last Super Admin guard", () => {
  beforeEach(() => {
    userFindUniqueOrThrow.mockReset();
    userCount.mockReset();
    userUpdate.mockReset();
  });

  it("refuses to revoke the sole remaining Super Admin", async () => {
    userFindUniqueOrThrow.mockResolvedValue({ id: "user_1", adminGroup: "SUPER_ADMIN" });
    userCount.mockResolvedValue(0); // no other Super Admins exist

    const result = await revokeAdminAccess("mem_1");

    expect(result).toEqual({
      ok: false,
      error: "At least one Super Admin account must remain — assign another Super Admin first.",
    });
    expect(userUpdate).not.toHaveBeenCalled();
  });

  it("allows revoking a Super Admin when another one still exists", async () => {
    userFindUniqueOrThrow.mockResolvedValue({ id: "user_1", adminGroup: "SUPER_ADMIN" });
    userCount.mockResolvedValue(1); // one other Super Admin exists
    userUpdate.mockResolvedValue({});

    const result = await revokeAdminAccess("mem_1");

    expect(result.ok).toBe(true);
    expect(userUpdate).toHaveBeenCalledTimes(1);
  });

  it("allows revoking a non-Super-Admin without checking the count at all", async () => {
    userFindUniqueOrThrow.mockResolvedValue({ id: "user_2", adminGroup: "TREASURER" });
    userUpdate.mockResolvedValue({});

    const result = await revokeAdminAccess("mem_2");

    expect(result.ok).toBe(true);
    expect(userCount).not.toHaveBeenCalled();
  });
});

describe("reactivateMember", () => {
  beforeEach(() => {
    memberFindUniqueOrThrow.mockReset();
    memberUpdate.mockReset();
    refreshMemberStatus.mockReset();
  });

  it("refuses to reactivate a member who isn't currently IN_ACTIVE", async () => {
    memberFindUniqueOrThrow.mockResolvedValue({ id: "mem_1", status: "ACTIVE" });

    const result = await reactivateMember("mem_1");

    expect(result).toEqual({ ok: false, error: "Only inactive (lapsed) members can be reactivated." });
    expect(memberUpdate).not.toHaveBeenCalled();
  });

  it("sets reinstatementDate and refreshes status for an IN_ACTIVE member", async () => {
    memberFindUniqueOrThrow.mockResolvedValue({ id: "mem_2", status: "IN_ACTIVE" });
    memberUpdate.mockResolvedValue({});
    refreshMemberStatus.mockResolvedValue({ status: "ACTIVE", terminationDate: null, projectedTerminationDate: null });

    const result = await reactivateMember("mem_2");

    expect(result.ok).toBe(true);
    expect(memberUpdate).toHaveBeenCalledWith({ where: { id: "mem_2" }, data: { reinstatementDate: expect.any(Date) } });
    expect(refreshMemberStatus).toHaveBeenCalledWith("mem_2");
  });
});

describe("accountStatus", () => {
  it("returns 'No account' when there's no linked User", () => {
    expect(accountStatus(null)).toBe("No account");
  });

  it("returns 'Disabled' when disabled is true, regardless of lock state", () => {
    expect(accountStatus({ disabled: true, lockedUntil: null })).toBe("Disabled");
  });

  it("returns 'Locked' when lockedUntil is in the future", () => {
    expect(accountStatus({ disabled: false, lockedUntil: new Date(Date.now() + 60_000) })).toBe("Locked");
  });

  it("returns 'Active' otherwise", () => {
    expect(accountStatus({ disabled: false, lockedUntil: null })).toBe("Active");
    expect(accountStatus({ disabled: false, lockedUntil: new Date(Date.now() - 60_000) })).toBe("Active");
  });
});
