"use server";

import { prisma } from "@/lib/prisma";
import { requireAdmin, requireAdminGroup } from "@/server/permissions";
import { uploadPrivateFile } from "@/lib/storage/blob";
import { recordPaymentWithAllocation } from "@/lib/business/contributionAllocation";
import {
  parseBankStatementCsv,
  classifyTransaction,
  matchMemberByReference,
  inferPaymentMethod,
  fingerprintTransaction,
} from "@/lib/business/bankStatementImport";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { formDataToObject } from "@/lib/formData";
import { toSafeErrorMessage } from "@/lib/actionError";
import { z } from "zod";
import { CommitteeRole } from "@prisma/client";
import { DEFAULT_PAGE_SIZE, paginationSkip } from "@/lib/pagination";
import type { ActionResult } from "./member";
import type { BankAccountType, BankTransactionCategory } from "@prisma/client";

export type ImportSummary = {
  matched: number;
  unmatched: number;
  transfers: number;
  fees: number;
  interest: number;
  expenseCandidates: number;
  duplicatesSkipped: number;
};

/**
 * Parses an uploaded bank statement CSV and, per row: auto-records a Payment
 * when an exact membership number is found in the description, otherwise
 * creates an UnallocatedFund deposit for manual matching on the existing
 * /admin/unallocated-funds screen. Transfers/interest/fees are recorded for
 * transparency only; unrecognized debits are queued as expense candidates
 * (see createExpenseFromBankTransaction). Every row becomes a BankTransaction
 * regardless of category, for a complete audit trail. Re-uploading a file (or
 * an overlapping date range) is a safe no-op via the fingerprint dedup check.
 */
export async function importBankStatement(formData: FormData): Promise<ActionResult<ImportSummary>> {
  try {
    const session = await requireAdminGroup("SUPER_ADMIN", "TREASURER");

    const file = formData.get("file");
    const accountType = formData.get("accountType") as BankAccountType | null;
    if (!(file instanceof File) || file.size === 0) return { ok: false, error: "No file provided." };
    if (accountType !== "OPERATING" && accountType !== "SAVINGS") {
      return { ok: false, error: "Select which account this statement is for." };
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const rows = await parseBankStatementCsv(buffer);
    if (rows.length === 0) return { ok: false, error: "No transaction rows found in this file." };

    const fingerprints = rows.map((r) => fingerprintTransaction({ accountType, ...r }));
    const existing = await prisma.bankTransaction.findMany({
      where: { fingerprint: { in: fingerprints } },
      select: { fingerprint: true },
    });
    const existingSet = new Set(existing.map((e) => e.fingerprint));

    const uploaded = await uploadPrivateFile(file, "bank-statements", { allowCsv: true });

    const summary: ImportSummary = {
      matched: 0,
      unmatched: 0,
      transfers: 0,
      fees: 0,
      interest: 0,
      expenseCandidates: 0,
      duplicatesSkipped: 0,
    };

    const closingBalance = rows[rows.length - 1].balance;

    const bankImport = await prisma.bankStatementImport.create({
      data: {
        accountType,
        fileName: file.name,
        closingBalance,
        transactionCount: rows.length,
        importedByUserId: session.user.id,
      },
    });

    await prisma.document.create({
      data: {
        ownerType: "BANK_STATEMENT",
        bankStatementImportId: bankImport.id,
        storageKey: uploaded.storageKey,
        fileName: uploaded.fileName,
        mimeType: uploaded.mimeType,
        sizeBytes: uploaded.sizeBytes,
        uploadedByUserId: session.user.id,
      },
    });

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const fingerprint = fingerprints[i];
      if (existingSet.has(fingerprint)) {
        summary.duplicatesSkipped++;
        continue;
      }

      const matchedMember = row.amount > 0 ? await matchMemberByReference(row.description) : null;
      const category = classifyTransaction(row.description, row.amount, !!matchedMember);

      let memberId: string | null = null;
      let paymentId: string | null = null;
      let unallocatedFundId: string | null = null;

      if (category === "CONTRIBUTION_MATCHED" && matchedMember) {
        memberId = matchedMember.id;
        const result = await recordPaymentWithAllocation({
          memberId: matchedMember.id,
          amount: row.amount,
          paymentDate: row.date,
          category: "MONTHLY_CONTRIBUTION",
          method: inferPaymentMethod(row.description),
          reference: row.description,
          notes: `Imported from bank statement "${file.name}".`,
          recordedByUserId: session.user.id,
        });
        paymentId = result.paymentId;
        summary.matched++;
      } else if (category === "CONTRIBUTION_UNMATCHED") {
        const fund = await prisma.unallocatedFund.create({
          data: {
            depositType: inferPaymentMethod(row.description) === "Cash" ? "CASH" : "EFT",
            amount: row.amount,
            depositDate: row.date,
            reference: row.description,
            notes: `Imported from bank statement "${file.name}" — could not match a membership number.`,
            recordedByUserId: session.user.id,
          },
        });
        unallocatedFundId = fund.id;
        summary.unmatched++;
      } else if (category === "TRANSFER_IN" || category === "TRANSFER_OUT") {
        summary.transfers++;
      } else if (category === "INTEREST") {
        summary.interest++;
      } else if (category === "BANK_FEE") {
        summary.fees++;
      } else {
        summary.expenseCandidates++;
      }

      await prisma.bankTransaction.create({
        data: {
          importId: bankImport.id,
          accountType,
          date: row.date,
          description: row.description,
          amount: row.amount,
          balance: row.balance,
          category,
          fingerprint,
          memberId,
          paymentId,
          unallocatedFundId,
        },
      });
    }

    await logAudit({
      entityType: "BankStatementImport",
      entityId: bankImport.id,
      action: "CREATE",
      performedByUserId: session.user.id,
      metadata: { accountType, fileName: file.name, ...summary },
    });

    revalidatePath("/admin/bank-statements");
    revalidatePath("/admin/unallocated-funds");
    revalidatePath("/admin/dashboard");
    return { ok: true, data: summary };
  } catch (e) {
    return { ok: false, error: toSafeErrorMessage(e, "Failed to import bank statement.") };
  }
}

const expenseFromTransactionSchema = z.object({
  bankTransactionId: z.string().min(1),
  description: z.string().trim().min(1, "Description is required."),
  spentByMemberId: z.string().min(1, "Select who spent the money."),
  approvedByRole: z.nativeEnum(CommitteeRole),
  notes: z.string().trim().optional(),
});

/**
 * Completes an EXPENSE_PENDING bank transaction into a real Expense. Unlike
 * createExpense (expense.ts), a receipt upload is optional here — the
 * schema never required one (createExpense's compulsory-receipt check is
 * application code, not a DB constraint) and a bank-statement-derived
 * expense already has the statement line itself as its evidence.
 */
export async function createExpenseFromBankTransaction(formData: FormData): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requireAdminGroup("SUPER_ADMIN", "TREASURER");
    const parsed = expenseFromTransactionSchema.safeParse(formDataToObject(formData));
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues.map((i) => i.message).join(" ") };
    }
    const data = parsed.data;

    const txn = await prisma.bankTransaction.findUniqueOrThrow({ where: { id: data.bankTransactionId } });
    if (txn.category !== "EXPENSE_PENDING") {
      return { ok: false, error: "This transaction has already been linked to an expense." };
    }

    const file = formData.get("file");
    const uploaded = file instanceof File && file.size > 0 ? await uploadPrivateFile(file, "expenses") : null;

    const expense = await prisma.$transaction(async (tx) => {
      const e = await tx.expense.create({
        data: {
          description: data.description,
          amount: Math.abs(Number(txn.amount)),
          expenseDate: txn.date,
          spentByMemberId: data.spentByMemberId,
          approvedByRole: data.approvedByRole,
          approvedByUserId: session.user.id,
          notes: [data.notes, `Imported from bank statement transaction: "${txn.description}".`].filter(Boolean).join(" "),
        },
      });
      if (uploaded) {
        await tx.document.create({
          data: {
            ownerType: "EXPENSE_PROOF",
            expenseId: e.id,
            ...uploaded,
            uploadedByUserId: session.user.id,
          },
        });
      }
      await tx.bankTransaction.update({
        where: { id: txn.id },
        data: { category: "EXPENSE_LINKED", expenseId: e.id },
      });
      return e;
    });

    await logAudit({
      entityType: "Expense",
      entityId: expense.id,
      memberId: data.spentByMemberId,
      action: "CREATE",
      performedByUserId: session.user.id,
      metadata: { amount: Number(expense.amount), source: "bank statement", bankTransactionId: txn.id },
    });

    revalidatePath("/admin/bank-statements");
    revalidatePath("/admin/expenses");
    return { ok: true, data: { id: expense.id } };
  } catch (e) {
    return { ok: false, error: toSafeErrorMessage(e, "Failed to create expense.") };
  }
}

export async function listBankStatementImports(query?: { search?: string; page?: number }) {
  await requireAdmin();
  const page = Math.max(1, query?.page ?? 1);
  const where = query?.search ? { fileName: { contains: query.search, mode: "insensitive" as const } } : {};
  return prisma.bankStatementImport.findMany({
    where,
    orderBy: [{ importedAt: "desc" }, { id: "asc" }],
    include: { documents: true },
    skip: paginationSkip(page, DEFAULT_PAGE_SIZE),
    take: DEFAULT_PAGE_SIZE,
  });
}

export async function countBankStatementImports(query?: { search?: string }) {
  await requireAdmin();
  const where = query?.search ? { fileName: { contains: query.search, mode: "insensitive" as const } } : {};
  return prisma.bankStatementImport.count({ where });
}

export async function listBankTransactions(category?: BankTransactionCategory) {
  await requireAdmin();
  return prisma.bankTransaction.findMany({
    where: category ? { category } : undefined,
    orderBy: { date: "desc" },
    include: { member: true },
  });
}

export async function countBankTransactions(category?: BankTransactionCategory) {
  await requireAdmin();
  return prisma.bankTransaction.count({ where: category ? { category } : undefined });
}

/**
 * Paginated/searchable transaction list spanning multiple categories — the
 * "Transfers, interest & fees" table needs all four non-ledger categories
 * merged and sorted by date, which a single query supports directly
 * (avoiding four full, unpaginated listBankTransactions() calls merged in JS).
 */
export async function listBankTransactionsByCategories(
  categories: BankTransactionCategory[],
  query?: { search?: string; page?: number }
) {
  await requireAdmin();
  const page = Math.max(1, query?.page ?? 1);
  const where = {
    category: { in: categories },
    ...(query?.search ? { description: { contains: query.search, mode: "insensitive" as const } } : {}),
  };
  return prisma.bankTransaction.findMany({
    where,
    orderBy: [{ date: "desc" }, { id: "asc" }],
    include: { member: true },
    skip: paginationSkip(page, DEFAULT_PAGE_SIZE),
    take: DEFAULT_PAGE_SIZE,
  });
}

export async function countBankTransactionsByCategories(categories: BankTransactionCategory[], query?: { search?: string }) {
  await requireAdmin();
  const where = {
    category: { in: categories },
    ...(query?.search ? { description: { contains: query.search, mode: "insensitive" as const } } : {}),
  };
  return prisma.bankTransaction.count({ where });
}

/**
 * Reads the most recently imported SAVINGS-account transaction's own stated
 * balance — the source statement is already authoritative, so this avoids
 * an independently-computed running total that could drift from it.
 */
export async function getSavingsBalance(): Promise<number> {
  const latest = await prisma.bankTransaction.findFirst({
    where: { accountType: "SAVINGS" },
    orderBy: { date: "desc" },
  });
  return latest ? Number(latest.balance) : 0;
}
