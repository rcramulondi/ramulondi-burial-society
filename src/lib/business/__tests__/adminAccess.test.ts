import { describe, it, expect, vi, beforeEach } from "vitest";

const findMany = vi.fn();
const findFirst = vi.fn();
const update = vi.fn();

vi.mock("../../prisma", () => ({
  prisma: {
    user: { findMany, update },
    committeeTerm: { findFirst },
  },
}));
vi.mock("../../audit", () => ({ logAudit: vi.fn() }));

const { refreshAllAdminAccess, eligibleAdminGroupForCommitteeRole } = await import("../adminAccess");

describe("eligibleAdminGroupForCommitteeRole", () => {
  it("maps TREASURER to the Treasurer group", () => {
    expect(eligibleAdminGroupForCommitteeRole("TREASURER")).toBe("TREASURER");
  });

  it("maps SECRETARY and VICE_SECRETARY to the Secretary group", () => {
    expect(eligibleAdminGroupForCommitteeRole("SECRETARY")).toBe("SECRETARY");
    expect(eligibleAdminGroupForCommitteeRole("VICE_SECRETARY")).toBe("SECRETARY");
  });

  it("maps every other committee role to the Chairperson (view-only) group", () => {
    expect(eligibleAdminGroupForCommitteeRole("CHAIRPERSON")).toBe("CHAIRPERSON");
    expect(eligibleAdminGroupForCommitteeRole("VICE_CHAIR")).toBe("CHAIRPERSON");
    expect(eligibleAdminGroupForCommitteeRole("ADDITIONAL_MEMBER")).toBe("CHAIRPERSON");
    expect(eligibleAdminGroupForCommitteeRole("ADDITIONAL_MEMBER_2")).toBe("CHAIRPERSON");
    expect(eligibleAdminGroupForCommitteeRole("YOUTH_COORDINATOR")).toBe("CHAIRPERSON");
  });
});

describe("refreshAllAdminAccess", () => {
  beforeEach(() => {
    findMany.mockReset();
    findFirst.mockReset();
    update.mockReset();
  });

  it("demotes an admin whose committee term has ended (no active term)", async () => {
    findMany.mockResolvedValue([{ id: "user_1", memberId: "mem_1", adminGroup: "TREASURER" }]);
    findFirst.mockResolvedValue(null);

    const count = await refreshAllAdminAccess();

    expect(count).toBe(1);
    expect(update).toHaveBeenCalledWith({ where: { id: "user_1" }, data: { role: "MEMBER", adminGroup: null } });
  });

  it("demotes an admin whose current role no longer matches their assigned group", async () => {
    findMany.mockResolvedValue([{ id: "user_2", memberId: "mem_2", adminGroup: "TREASURER" }]);
    findFirst.mockResolvedValue({ role: "SECRETARY", memberId: "mem_2", endDate: null });

    const count = await refreshAllAdminAccess();

    expect(count).toBe(1);
    expect(update).toHaveBeenCalledTimes(1);
  });

  it("leaves an admin alone whose active term still matches their group", async () => {
    findMany.mockResolvedValue([{ id: "user_3", memberId: "mem_3", adminGroup: "TREASURER" }]);
    findFirst.mockResolvedValue({ role: "TREASURER", memberId: "mem_3", endDate: null });

    const count = await refreshAllAdminAccess();

    expect(count).toBe(0);
    expect(update).not.toHaveBeenCalled();
  });

  it("never queries Super Admins in the first place (excluded at the findMany filter)", async () => {
    findMany.mockResolvedValue([]);
    await refreshAllAdminAccess();
    expect(findMany).toHaveBeenCalledWith({
      where: { role: "ADMIN", adminGroup: { not: "SUPER_ADMIN" }, memberId: { not: null } },
    });
  });
});
