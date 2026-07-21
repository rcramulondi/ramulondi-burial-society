import { describe, it, expect, vi } from "vitest";

const member = {
  id: "mem_1",
  type: "MAIN" as const,
  dateJoined: new Date(Date.UTC(2025, 0, 1)), // Jan 2025
  reinstatementDate: null,
};

const rates = [
  {
    id: "rate_burial",
    membershipType: "MAIN",
    fund: "BURIAL",
    amount: { toString: () => "80" } as unknown as number,
    effectiveFrom: new Date(Date.UTC(2020, 0, 1)),
    effectiveTo: null,
  },
  {
    id: "rate_food",
    membershipType: "MAIN",
    fund: "FOOD",
    amount: { toString: () => "20" } as unknown as number,
    effectiveFrom: new Date(Date.UTC(2020, 0, 1)),
    effectiveTo: null,
  },
];

const allocations = [
  { id: "a1", paymentId: "p1", memberId: "mem_1", fund: "BURIAL", year: 2025, month: 1, amount: 80, createdAt: new Date() },
  { id: "a2", paymentId: "p1", memberId: "mem_1", fund: "FOOD", year: 2025, month: 1, amount: 20, createdAt: new Date() },
];

const findUniqueOrThrow = vi.fn().mockResolvedValue(member);
const findManyMember = vi.fn().mockResolvedValue([member]);
const findManyRate = vi.fn().mockResolvedValue(rates);
const findManyAllocation = vi.fn().mockResolvedValue(allocations);

vi.mock("../../prisma", () => ({
  prisma: {
    member: { findUniqueOrThrow, findMany: findManyMember },
    contributionRate: { findMany: findManyRate },
    paymentAllocation: { findMany: findManyAllocation },
  },
}));

vi.mock("../memberStatus", () => ({ refreshMemberStatus: vi.fn() }));

const { getOutstandingBalance, getOutstandingBalancesForMembers } = await import("../contributionAllocation");

describe("getOutstandingBalancesForMembers parity with getOutstandingBalance", () => {
  it("matches the single-member function's result for the same member/asOf", async () => {
    const asOf = new Date(Date.UTC(2025, 2, 15)); // March 2025 -> Jan/Feb/Mar elapsed

    const single = await getOutstandingBalance(member.id, asOf);
    const batched = await getOutstandingBalancesForMembers([member.id], asOf);

    expect(batched.get(member.id)?.outstandingBalance).toBe(single);
  });

  it("also returns contributions-to-date summed from the same allocations", async () => {
    const batched = await getOutstandingBalancesForMembers([member.id], new Date(Date.UTC(2025, 2, 15)));
    expect(batched.get(member.id)?.contributionsToDate).toBe(100);
  });
});
