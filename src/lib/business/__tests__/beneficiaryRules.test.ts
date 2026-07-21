import { describe, it, expect, vi, beforeEach } from "vitest";

const findFirst = vi.fn();

vi.mock("../../prisma", () => ({
  prisma: { beneficiary: { findFirst } },
}));

const { assertNotReRegisteringDeceased, BeneficiaryRuleError } = await import("../beneficiaryRules");

describe("assertNotReRegisteringDeceased", () => {
  beforeEach(() => {
    findFirst.mockReset();
  });

  it("resolves silently when no deceased beneficiary shares the ID number", async () => {
    findFirst.mockResolvedValue(null);
    await expect(assertNotReRegisteringDeceased("8001015009087")).resolves.toBeUndefined();
    expect(findFirst).toHaveBeenCalledWith({
      where: { idNumber: "8001015009087", status: "DECEASED" },
    });
  });

  it("throws when a beneficiary with that ID number is already recorded as deceased", async () => {
    findFirst.mockResolvedValue({ id: "ben_1", idNumber: "8001015009087", status: "DECEASED" });
    await expect(assertNotReRegisteringDeceased("8001015009087")).rejects.toBeInstanceOf(
      BeneficiaryRuleError
    );
  });
});
