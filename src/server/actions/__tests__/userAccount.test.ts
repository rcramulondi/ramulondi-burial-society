import { describe, it, expect, vi, beforeEach } from "vitest";

const findUniqueOrThrow = vi.fn();
const count = vi.fn();
const update = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: { user: { findUniqueOrThrow, count, update } },
}));
vi.mock("@/server/permissions", () => ({
  requireAdminGroup: vi.fn().mockResolvedValue({ user: { id: "super_1", role: "ADMIN", adminGroup: "SUPER_ADMIN" } }),
}));
vi.mock("@/lib/audit", () => ({ logAudit: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/actionError", () => ({
  toSafeErrorMessage: (_e: unknown, fallback: string) => fallback,
}));
vi.mock("./activation", () => ({ createUserSeededFromMember: vi.fn() }));
vi.mock("@/lib/business/adminAccess", () => ({ eligibleAdminGroupForCommitteeRole: vi.fn() }));
vi.mock("@/lib/statusLabels", () => ({ COMMITTEE_ROLE_LABELS: {} }));

const { revokeAdminAccess } = await import("../userAccount");

describe("revokeAdminAccess — last Super Admin guard", () => {
  beforeEach(() => {
    findUniqueOrThrow.mockReset();
    count.mockReset();
    update.mockReset();
  });

  it("refuses to revoke the sole remaining Super Admin", async () => {
    findUniqueOrThrow.mockResolvedValue({ id: "user_1", adminGroup: "SUPER_ADMIN" });
    count.mockResolvedValue(0); // no other Super Admins exist

    const result = await revokeAdminAccess("mem_1");

    expect(result).toEqual({
      ok: false,
      error: "At least one Super Admin account must remain — assign another Super Admin first.",
    });
    expect(update).not.toHaveBeenCalled();
  });

  it("allows revoking a Super Admin when another one still exists", async () => {
    findUniqueOrThrow.mockResolvedValue({ id: "user_1", adminGroup: "SUPER_ADMIN" });
    count.mockResolvedValue(1); // one other Super Admin exists
    update.mockResolvedValue({});

    const result = await revokeAdminAccess("mem_1");

    expect(result.ok).toBe(true);
    expect(update).toHaveBeenCalledTimes(1);
  });

  it("allows revoking a non-Super-Admin without checking the count at all", async () => {
    findUniqueOrThrow.mockResolvedValue({ id: "user_2", adminGroup: "TREASURER" });
    update.mockResolvedValue({});

    const result = await revokeAdminAccess("mem_2");

    expect(result.ok).toBe(true);
    expect(count).not.toHaveBeenCalled();
  });
});
