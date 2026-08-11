import { describe, it, expect, vi, beforeEach } from "vitest";

const findUnique = vi.fn();
vi.mock("../../prisma", () => ({
  prisma: { member: { findUnique } },
}));

const {
  parseBankStatementCsv,
  classifyTransaction,
  matchMemberByReference,
  inferPaymentMethod,
  fingerprintTransaction,
} = await import("../bankStatementImport");

describe("parseBankStatementCsv", () => {
  it("parses Date/Description/Amount/Balance rows, skipping the header", async () => {
    const csv = [
      "Date,Description,Amount,Balance",
      "20260407,CARDLESS CASH DEP REF:  thanyi ramulondi CELL NR: 0084,120.00,2799.78",
      "20260407,CASH DEPOSIT FEE,-7.70,2792.08",
    ].join("\n");
    const rows = await parseBankStatementCsv(Buffer.from(csv));

    expect(rows).toHaveLength(2);
    expect(rows[0].date.toISOString().slice(0, 10)).toBe("2026-04-07");
    expect(rows[0].description).toBe("CARDLESS CASH DEP REF:  thanyi ramulondi CELL NR: 0084");
    expect(rows[0].amount).toBe(120);
    expect(rows[0].balance).toBe(2799.78);
    expect(rows[1].amount).toBe(-7.7);
  });

  it("correctly handles a description containing a quoted comma", async () => {
    const csv = [
      "Date,Description,Amount,Balance",
      '20260419,"INETBNK PAY CREDIT ABSA BANK 99, 156, 157, 158",320.00,16540.73',
    ].join("\n");
    const rows = await parseBankStatementCsv(Buffer.from(csv));
    expect(rows).toHaveLength(1);
    expect(rows[0].description).toBe("INETBNK PAY CREDIT ABSA BANK 99, 156, 157, 158");
    expect(rows[0].amount).toBe(320);
  });
});

describe("classifyTransaction", () => {
  it("classifies a transfer to the investment account as TRANSFER_OUT", () => {
    expect(classifyTransaction("DIGITAL TRANSF DT ABSA BANK Investment", -16500, false)).toBe("TRANSFER_OUT");
  });

  it("classifies the paired investment-account credit as TRANSFER_IN", () => {
    expect(classifyTransaction("INETBNK TRF CREDIT ABSA BANK Investment", 16500, false)).toBe("TRANSFER_IN");
  });

  it("does not confuse a regular EFT payment (INETBNK PAY CREDIT) with a transfer (INETBNK TRF CREDIT)", () => {
    expect(classifyTransaction("INETBNK PAY CREDIT ABSA BANK Ramulondi Dzilafho", 960, false)).toBe("CONTRIBUTION_UNMATCHED");
  });

  it("classifies CREDIT INTEREST as INTEREST", () => {
    expect(classifyTransaction("CREDIT INTEREST", 0.15, false)).toBe("INTEREST");
  });

  it("classifies cash deposit and administration fees as BANK_FEE", () => {
    expect(classifyTransaction("CASH DEPOSIT FEE", -7.7, false)).toBe("BANK_FEE");
    expect(classifyTransaction("ADMINISTRATION FEE", -115, false)).toBe("BANK_FEE");
  });

  it("classifies an unmatched credit as CONTRIBUTION_UNMATCHED and a matched one as CONTRIBUTION_MATCHED", () => {
    expect(classifyTransaction("DIRECT CREDIT CAPITEC   RAMU0110", 960, false)).toBe("CONTRIBUTION_UNMATCHED");
    expect(classifyTransaction("DIRECT CREDIT CAPITEC   RAMU0110", 960, true)).toBe("CONTRIBUTION_MATCHED");
  });

  it("classifies an unrecognized debit as EXPENSE_PENDING", () => {
    expect(classifyTransaction("EFT PAYMENT TO SUPPLIER XYZ", -500, false)).toBe("EXPENSE_PENDING");
  });
});

describe("matchMemberByReference", () => {
  beforeEach(() => findUnique.mockReset());

  it("matches an exact membership number embedded in the description", async () => {
    findUnique.mockResolvedValue({ id: "mem_1", membershipNo: "RAMU0110" });
    const result = await matchMemberByReference("DIRECT CREDIT CAPITEC   RAMU0110");
    expect(result).toEqual({ id: "mem_1", membershipNo: "RAMU0110" });
    expect(findUnique).toHaveBeenCalledWith({ where: { membershipNo: "RAMU0110" } });
  });

  it("returns null when no membership-number pattern is present (plain name reference)", async () => {
    const result = await matchMemberByReference("CARDLESS CASH DEP REF:  thanyi ramulondi CELL NR: 0084");
    expect(result).toBeNull();
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("does not false-positive-match a cell-number fragment as a membership number", async () => {
    const result = await matchMemberByReference("CARDLESS CASH DEP REF:  suzan ramulondi CELL NR: 6863");
    expect(result).toBeNull();
  });
});

describe("inferPaymentMethod", () => {
  it("infers Cash for cash-deposit descriptions", () => {
    expect(inferPaymentMethod("CARDLESS CASH DEP REF:  damaris CELL NR: 7107")).toBe("Cash");
  });

  it("infers EFT for everything else", () => {
    expect(inferPaymentMethod("DIRECT CREDIT CAPITEC   RAMU0110")).toBe("EFT");
    expect(inferPaymentMethod("PayShap Ext Credit REF:  Ramulondi Johanna")).toBe("EFT");
  });
});

describe("fingerprintTransaction", () => {
  const base = { accountType: "OPERATING" as const, date: new Date("2026-04-07"), description: "CASH DEPOSIT FEE", amount: -7.7, balance: 2792.08 };

  it("is stable for identical input", () => {
    expect(fingerprintTransaction(base)).toBe(fingerprintTransaction({ ...base }));
  });

  it("differs when any field differs", () => {
    const fp = fingerprintTransaction(base);
    expect(fingerprintTransaction({ ...base, amount: -9.1 })).not.toBe(fp);
    expect(fingerprintTransaction({ ...base, balance: 1000 })).not.toBe(fp);
    expect(fingerprintTransaction({ ...base, accountType: "SAVINGS" })).not.toBe(fp);
  });
});
