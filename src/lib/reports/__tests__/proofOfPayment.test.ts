import { describe, it, expect, vi } from "vitest";

const findUniqueOrThrow = vi.fn();

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({
  prisma: { payment: { findUniqueOrThrow } },
}));

const { generateProofOfPaymentPdf } = await import("../proofOfPayment");

const paymentWithAllocations = {
  id: "pay_1",
  amount: 320,
  paymentDate: new Date("2026-06-15"),
  category: "MONTHLY_CONTRIBUTION",
  method: "Cash",
  reference: null,
  member: { firstName: "Jane", surname: "Doe", membershipNo: "DOEJ0001" },
  allocations: [
    { id: "alloc_1", year: 2026, month: 5, fund: "BURIAL", amount: 160 },
    { id: "alloc_2", year: 2026, month: 6, fund: "BURIAL", amount: 160 },
  ],
};

// react-pdf's content streams are FlateDecode-compressed, so the rendered
// text isn't searchable as plain ASCII in the raw buffer — comparing sizes
// is a reliable, simpler proxy for "the breakdown table was included/omitted"
// than decompressing PDF content streams just to assert on this one flag.
describe("generateProofOfPaymentPdf includeBreakdown", () => {
  it("produces a smaller PDF when the breakdown table is omitted", async () => {
    findUniqueOrThrow.mockResolvedValue(paymentWithAllocations);
    const withBreakdown = await generateProofOfPaymentPdf("pay_1");
    const withoutBreakdown = await generateProofOfPaymentPdf("pay_1", false);
    expect(withoutBreakdown.length).toBeLessThan(withBreakdown.length);
  });

  it("defaults to including the breakdown (existing download route's behavior, unchanged)", async () => {
    findUniqueOrThrow.mockResolvedValue(paymentWithAllocations);
    const defaultCall = await generateProofOfPaymentPdf("pay_1");
    const explicitTrue = await generateProofOfPaymentPdf("pay_1", true);
    expect(defaultCall.length).toBe(explicitTrue.length);
  });

  it("produces a valid PDF buffer with no allocations regardless of the flag", async () => {
    findUniqueOrThrow.mockResolvedValue({ ...paymentWithAllocations, allocations: [] });
    const pdf = await generateProofOfPaymentPdf("pay_1", false);
    expect(pdf.subarray(0, 5).toString("ascii")).toBe("%PDF-");
  });
});
