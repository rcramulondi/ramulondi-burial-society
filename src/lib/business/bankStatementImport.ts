import ExcelJS from "exceljs";
import { Readable } from "stream";
import crypto from "crypto";
import { prisma } from "../prisma";
import type { BankAccountType, BankTransactionCategory, Member } from "@prisma/client";

export type ParsedBankRow = {
  date: Date;
  description: string;
  amount: number;
  balance: number;
};

/**
 * Parses a bank statement CSV (Date as YYYYMMDD, Description, Amount,
 * Balance — the format both the operating and investment account exports
 * use). Uses ExcelJS's built-in CSV reader (already a dependency, backed by
 * fast-csv) rather than a hand-rolled splitter, since at least one real
 * description contains a comma inside quotes ("...ABSA BANK 99, 156, 157,
 * 158") that a naive split(",") would corrupt.
 */
export async function parseBankStatementCsv(buffer: Buffer): Promise<ParsedBankRow[]> {
  const workbook = new ExcelJS.Workbook();
  const sheet = await workbook.csv.read(Readable.from(buffer));

  const rows: ParsedBankRow[] = [];
  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const rawDate = row.getCell(1).value;
    const description = row.getCell(2).value;
    const amount = row.getCell(3).value;
    const balance = row.getCell(4).value;
    if (rawDate == null || description == null) continue;

    const dateStr = String(rawDate);
    const year = Number(dateStr.slice(0, 4));
    const month = Number(dateStr.slice(4, 6));
    const day = Number(dateStr.slice(6, 8));

    rows.push({
      date: new Date(Date.UTC(year, month - 1, day)),
      description: String(description).trim(),
      amount: Number(amount),
      balance: Number(balance),
    });
  }
  return rows;
}

/**
 * Pattern-based classification, derived directly from the real statement
 * data's distinct markers — see docs/REQUIREMENTS.md / the plan for the
 * reasoning behind each pattern. `isMatched` only matters when the result
 * would otherwise be a contribution (a credit that isn't a transfer/
 * interest); the caller resolves the member match separately since that
 * needs a DB lookup.
 */
export function classifyTransaction(
  description: string,
  amount: number,
  isMatched: boolean
): BankTransactionCategory {
  const desc = description.trim();

  if (amount > 0 && desc.toUpperCase().startsWith("INETBNK TRF CREDIT")) return "TRANSFER_IN";
  if (amount < 0 && desc.toUpperCase().startsWith("DIGITAL TRANSF")) return "TRANSFER_OUT";
  if (desc.toUpperCase() === "CREDIT INTEREST") return "INTEREST";
  if (/CASH DEPOSIT FEE|ADMIN(ISTRATION)? FEE/i.test(desc)) return "BANK_FEE";

  if (amount > 0) return isMatched ? "CONTRIBUTION_MATCHED" : "CONTRIBUTION_UNMATCHED";
  return "EXPENSE_PENDING";
}

// Matches this app's own generated membership-number format (e.g. RAMU0110,
// KWIN0002) — see generateMembershipNumber in membershipNumber.ts.
const MEMBERSHIP_NO_PATTERN = /\b[A-Z]{3,5}\d{3,4}\b/;

/**
 * Exact membership-number match only — deliberately NOT a fuzzy name match.
 * Bank descriptions overwhelmingly reference people's first/last names, and
 * "Ramulondi" is the surname of a large fraction of this society's members
 * (it's also the society's own name), so a fuzzy name match would risk
 * silently crediting the wrong member's contribution. Anything without an
 * unambiguous membership-number reference is left for manual matching via
 * the existing Unallocated Funds screen.
 */
export async function matchMemberByReference(description: string): Promise<Member | null> {
  const match = description.toUpperCase().match(MEMBERSHIP_NO_PATTERN);
  if (!match) return null;
  return prisma.member.findUnique({ where: { membershipNo: match[0] } });
}

/** "Cash" for cash-deposit-style descriptions, else "EFT" — used as the recorded Payment method. */
export function inferPaymentMethod(description: string): "Cash" | "EFT" {
  return /^(CARDLESS )?CASH DEP/i.test(description.trim()) ? "Cash" : "EFT";
}

/**
 * Stable dedup key so re-uploading the same file (or an overlapping date
 * range in a later export) never creates duplicate transactions/payments —
 * checked against BankTransaction.fingerprint (unique) before any row is
 * processed.
 */
export function fingerprintTransaction(input: {
  accountType: BankAccountType;
  date: Date;
  description: string;
  amount: number;
  balance: number;
}): string {
  const raw = `${input.accountType}|${input.date.toISOString().slice(0, 10)}|${input.description}|${input.amount.toFixed(2)}|${input.balance.toFixed(2)}`;
  return crypto.createHash("sha256").update(raw).digest("hex");
}
