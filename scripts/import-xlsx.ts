/**
 * Imports historical membership + contribution data from the source
 * spreadsheet (RAMULONDI Payment Sheet ....xlsx) into the database.
 *
 * Usage: npm run import:xlsx -- "/path/to/RAMULONDI Payment Sheet 2026 June.xlsx"
 *
 * The workbook is never committed to git (see .gitignore) — run this against
 * a local copy, pointed at DIRECT_URL, from a trusted machine.
 */
import ExcelJS from "exceljs";
import { randomUUID } from "crypto";
import { prisma } from "../src/lib/prisma";
import { generateMembershipNumber } from "../src/lib/business/membershipNumber";
import { refreshMemberStatus } from "../src/lib/business/memberStatus";
import type { Gender, MembershipType, Fund } from "@prisma/client";

const YEARS = [2024, 2025, 2026];
const MONTH_COLUMNS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

type RawMemberRow = {
  no: number;
  name: string;
  surname: string;
  gender: Gender | null;
  type: MembershipType | null;
  dateJoined: Date | null;
  deceasedDate: Date | null;
  joiningFee: number;
};

type RawFundRow = {
  no: number;
  monthly: number[]; // 12 values, Jan..Dec
};

/**
 * ExcelJS returns formula cells as `{ formula, result, ... }` objects rather
 * than their computed value — unwrap to the cached `result` when present.
 * (Plain literal cells, e.g. the hand-entered monthly amounts in the Members
 * sheets, come through as plain values already and pass through unchanged.)
 */
function unwrap(raw: ExcelJS.CellValue): unknown {
  if (raw !== null && typeof raw === "object" && "result" in raw) {
    return (raw as { result: unknown }).result;
  }
  return raw;
}

function cell(row: ExcelJS.Row, col: number): unknown {
  return unwrap(row.getCell(col).value);
}

function normalizeName(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeGender(raw: unknown): Gender | null {
  const s = String(raw ?? "").trim().toUpperCase();
  if (s.startsWith("M")) return "MALE";
  if (s.startsWith("F")) return "FEMALE";
  return null;
}

function normalizeType(raw: unknown): MembershipType | null {
  const s = String(raw ?? "").trim().toUpperCase();
  if (s === "KHADZI") return "KHADZI";
  if (s === "MAIN") return "MAIN";
  return null;
}

function parseSheetDate(raw: unknown): Date | null {
  if (raw == null || raw === "") return null;
  if (raw instanceof Date) return raw;
  if (typeof raw === "number") {
    // Excel serial date (days since 1899-12-30)
    return new Date(Date.UTC(1899, 11, 30) + raw * 86400000);
  }
  if (typeof raw === "string") {
    const m = raw.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); // DD/MM/YYYY (SA convention)
    if (m) {
      const [, dd, mm, yyyy] = m;
      const d = new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd)));
      if (!Number.isNaN(d.getTime())) return d;
    }
  }
  return null;
}

function toNumber(raw: unknown): number {
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

async function readMembersSheet(workbook: ExcelJS.Workbook, year: number): Promise<RawMemberRow[]> {
  const sheet = workbook.getWorksheet(`Members ${year}`);
  if (!sheet) throw new Error(`Sheet "Members ${year}" not found`);

  const rows: RawMemberRow[] = [];
  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const no = cell(row, 1);
    const name = cell(row, 3);
    if (no == null && (name == null || name === "")) break; // hit the padded blank tail
    if (String(name ?? "").trim().toUpperCase() === "TOTAL") break; // hit the sheet's trailing TOTAL row

    if (name == null || name === "") continue;

    rows.push({
      no: toNumber(no),
      name: String(name).trim(),
      surname: String(cell(row, 4) ?? "").trim(),
      gender: normalizeGender(cell(row, 5)),
      type: normalizeType(cell(row, 6)),
      dateJoined: parseSheetDate(cell(row, 8)),
      deceasedDate: parseSheetDate(cell(row, 9)),
      joiningFee: toNumber(cell(row, 11)),
    });
  }
  return rows;
}

async function readFundSheet(workbook: ExcelJS.Workbook, sheetName: string): Promise<RawFundRow[]> {
  const sheet = workbook.getWorksheet(sheetName);
  if (!sheet) throw new Error(`Sheet "${sheetName}" not found`);

  const rows: RawFundRow[] = [];
  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const no = cell(row, 1);
    const name = cell(row, 3);
    if (no == null && (name == null || name === "")) break;
    if (String(name ?? "").trim().toUpperCase() === "TOTAL") break;
    if (name == null || name === "") continue;

    const monthly = MONTH_COLUMNS.map((_, i) => toNumber(cell(row, 12 + i))); // L=12 .. W=23
    rows.push({ no: toNumber(no), monthly });
  }
  return rows;
}

function mostCommonNonZero(values: number[]): number {
  const counts = new Map<number, number>();
  for (const v of values) {
    if (v > 0) counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  let best = 0;
  let bestCount = 0;
  for (const [v, c] of counts) {
    if (c > bestCount) {
      best = v;
      bestCount = c;
    }
  }
  return best;
}

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Usage: npm run import:xlsx -- \"/path/to/workbook.xlsx\"");
    process.exit(1);
  }

  console.log(`Loading workbook: ${filePath}`);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  // --- 1. Read all years' data ---
  const membersByYear = new Map<number, RawMemberRow[]>();
  const burialByYear = new Map<number, RawFundRow[]>();
  const foodByYear = new Map<number, RawFundRow[]>();

  for (const year of YEARS) {
    membersByYear.set(year, await readMembersSheet(workbook, year));
    burialByYear.set(year, await readFundSheet(workbook, `Burial Contribution ${year}`));
    foodByYear.set(year, await readFundSheet(workbook, `Food-${year}`));
    console.log(`Year ${year}: ${membersByYear.get(year)!.length} member rows`);
  }

  // --- 2. Derive contribution rates per year/type/fund from the modal non-zero monthly value ---
  console.log("\nDeriving contribution rates per year...");
  for (const year of YEARS) {
    const members = membersByYear.get(year)!;
    const burial = burialByYear.get(year)!;
    const food = foodByYear.get(year)!;

    for (const type of ["MAIN", "KHADZI"] as MembershipType[]) {
      const nos = new Set(members.filter((m) => m.type === type).map((m) => m.no));
      const burialValues = burial.filter((b) => nos.has(b.no)).flatMap((b) => b.monthly);
      const foodValues = food.filter((f) => nos.has(f.no)).flatMap((f) => f.monthly);

      const burialRate = mostCommonNonZero(burialValues);
      const foodRate = mostCommonNonZero(foodValues);

      for (const [fund, amount] of [["BURIAL", burialRate], ["FOOD", foodRate]] as [Fund, number][]) {
        if (amount <= 0) continue;
        const effectiveFrom = new Date(Date.UTC(year, 0, 1));
        await prisma.contributionRate.upsert({
          where: { membershipType_fund_effectiveFrom: { membershipType: type, fund, effectiveFrom } },
          create: { membershipType: type, fund, amount, effectiveFrom },
          update: { amount },
        });
        console.log(`  ${year} ${type} ${fund}: R${amount}/month`);
      }
    }
  }

  // Close off any rate with no explicit effectiveTo whose year isn't the latest, so history is bounded.
  const allRates = await prisma.contributionRate.findMany({ orderBy: { effectiveFrom: "asc" } });
  const byTypeFund = new Map<string, typeof allRates>();
  for (const r of allRates) {
    const key = `${r.membershipType}|${r.fund}`;
    byTypeFund.set(key, [...(byTypeFund.get(key) ?? []), r]);
  }
  for (const rates of byTypeFund.values()) {
    for (let i = 0; i < rates.length - 1; i++) {
      if (rates[i].effectiveTo === null) {
        await prisma.contributionRate.update({
          where: { id: rates[i].id },
          data: { effectiveTo: rates[i + 1].effectiveFrom },
        });
      }
    }
  }

  // --- 3. Merge member identities across years by normalized (name, surname) ---
  type MergedMember = {
    name: string;
    surname: string;
    gender: Gender;
    type: MembershipType;
    dateJoined: Date | null;
    deceasedDate: Date | null;
    firstYearSeen: number;
    perYear: Map<number, { no: number; joiningFee: number }>;
  };

  const merged = new Map<string, MergedMember>();
  for (const year of YEARS) {
    for (const row of membersByYear.get(year)!) {
      const key = `${normalizeName(row.name)}|${normalizeName(row.surname)}`;
      const existing = merged.get(key);
      if (existing) {
        existing.perYear.set(year, { no: row.no, joiningFee: row.joiningFee });
        existing.dateJoined = existing.dateJoined ?? row.dateJoined;
        existing.deceasedDate = existing.deceasedDate ?? row.deceasedDate;
        existing.gender = existing.gender ?? row.gender ?? "MALE";
        existing.type = existing.type ?? row.type ?? "MAIN";
      } else {
        merged.set(key, {
          name: row.name,
          surname: row.surname,
          gender: row.gender ?? "MALE",
          type: row.type ?? "MAIN",
          dateJoined: row.dateJoined,
          deceasedDate: row.deceasedDate,
          firstYearSeen: year,
          perYear: new Map([[year, { no: row.no, joiningFee: row.joiningFee }]]),
        });
      }
    }
  }
  console.log(`\nMerged into ${merged.size} unique members across ${YEARS.join(", ")}.`);

  // --- 4. Upsert members, payments, allocations ---
  let importedMembers = 0;
  let importedPayments = 0;
  let estimatedJoinDates = 0;
  const mismatches: string[] = [];

  for (const m of merged.values()) {
    try {
      const dateJoined = m.dateJoined ?? new Date(Date.UTC(m.firstYearSeen, 0, 1));
      if (!m.dateJoined) estimatedJoinDates++;

      const existing = await prisma.member.findFirst({
        where: { firstName: m.name, surname: m.surname },
      });

      const member = existing
        ? await prisma.member.update({
            where: { id: existing.id },
            data: { deceasedDate: m.deceasedDate ?? existing.deceasedDate },
          })
        : await prisma.member.create({
            data: {
              membershipNo: await generateMembershipNumber(m.surname),
              firstName: m.name,
              surname: m.surname,
              gender: m.gender,
              type: m.type,
              dateJoined,
              deceasedDate: m.deceasedDate,
              packageNote: m.dateJoined ? null : "Join date estimated during import from spreadsheet history — verify with member.",
            },
          });

      // Fetch existing state once (not per month) to keep this idempotent without
      // one round-trip per month — a per-month findFirst() inside a single
      // interactive transaction was blowing Prisma's 5s transaction timeout for
      // members with multiple years of full payment history.
      const [existingAllocations, existingJoiningFee] = await Promise.all([
        prisma.paymentAllocation.findMany({
          where: { memberId: member.id },
          select: { year: true, month: true },
        }),
        prisma.payment.findFirst({ where: { memberId: member.id, category: "JOINING_FEE" } }),
      ]);
      const existingAllocationKeys = new Set(existingAllocations.map((a) => `${a.year}-${a.month}`));

      const paymentsToCreate: { id: string; memberId: string; category: "MONTHLY_CONTRIBUTION" | "JOINING_FEE"; amount: number; paymentDate: Date; notes: string }[] = [];
      const allocationsToCreate: { id: string; paymentId: string; memberId: string; fund: Fund; year: number; month: number; amount: number }[] = [];

      let joiningFeeHandled = !!existingJoiningFee;

      for (const [year, { no, joiningFee }] of m.perYear) {
        const burialRow = burialByYear.get(year)!.find((b) => b.no === no);
        const foodRow = foodByYear.get(year)!.find((f) => f.no === no);
        const memberRow = membersByYear.get(year)!.find((r) => r.no === no && normalizeName(r.name) === normalizeName(m.name));

        if (joiningFee > 0 && !joiningFeeHandled) {
          paymentsToCreate.push({
            id: randomUUID(),
            memberId: member.id,
            category: "JOINING_FEE",
            amount: joiningFee,
            paymentDate: dateJoined,
            notes: `Imported from ${year} spreadsheet`,
          });
          joiningFeeHandled = true;
        }

        let yearTotal = 0;
        for (let monthIdx = 0; monthIdx < 12; monthIdx++) {
          const burialAmount = burialRow?.monthly[monthIdx] ?? 0;
          const foodAmount = foodRow?.monthly[monthIdx] ?? 0;
          if (burialAmount <= 0 && foodAmount <= 0) continue;

          yearTotal += burialAmount + foodAmount;
          if (existingAllocationKeys.has(`${year}-${monthIdx + 1}`)) continue; // idempotent re-run

          const paymentId = randomUUID();
          paymentsToCreate.push({
            id: paymentId,
            memberId: member.id,
            category: "MONTHLY_CONTRIBUTION",
            amount: burialAmount + foodAmount,
            paymentDate: new Date(Date.UTC(year, monthIdx, 15)),
            notes: `Imported from ${year} spreadsheet`,
          });
          if (burialAmount > 0) allocationsToCreate.push({ id: randomUUID(), paymentId, memberId: member.id, fund: "BURIAL", year, month: monthIdx + 1, amount: burialAmount });
          if (foodAmount > 0) allocationsToCreate.push({ id: randomUUID(), paymentId, memberId: member.id, fund: "FOOD", year, month: monthIdx + 1, amount: foodAmount });
        }

        // Reconcile against the Members sheet's own "Total" column, if present.
        if (memberRow) {
          const sheetTotal = toNumber((await readMembersSheetTotalCell(workbook, year, no)) ?? 0);
          if (sheetTotal > 0 && Math.abs(sheetTotal - yearTotal) > 1) {
            mismatches.push(`${m.name} ${m.surname} (${year}): sheet total R${sheetTotal} vs imported R${yearTotal}`);
          }
        }
      }

      if (paymentsToCreate.length > 0) {
        await prisma.payment.createMany({ data: paymentsToCreate });
        importedPayments += paymentsToCreate.length;
      }
      if (allocationsToCreate.length > 0) {
        await prisma.paymentAllocation.createMany({ data: allocationsToCreate });
      }

      await refreshMemberStatus(member.id);
      importedMembers++;
    } catch (err) {
      console.error(`Failed to import ${m.name} ${m.surname}:`, err);
    }
  }

  console.log(`\nImport complete.`);
  console.log(`  Members imported/updated: ${importedMembers}`);
  console.log(`  Payments created: ${importedPayments}`);
  console.log(`  Members with an estimated (not sheet-provided) join date: ${estimatedJoinDates}`);
  if (mismatches.length > 0) {
    console.log(`\n${mismatches.length} totals mismatches (>R1) between the sheet and imported data — review manually:`);
    for (const msg of mismatches.slice(0, 50)) console.log(`  - ${msg}`);
    if (mismatches.length > 50) console.log(`  ...and ${mismatches.length - 50} more`);
  }
}

const totalCellCache = new Map<string, ExcelJS.Worksheet>();
async function readMembersSheetTotalCell(workbook: ExcelJS.Workbook, year: number, no: number): Promise<number | null> {
  const key = `Members ${year}`;
  let sheet = totalCellCache.get(key);
  if (!sheet) {
    sheet = workbook.getWorksheet(key)!;
    totalCellCache.set(key, sheet);
  }
  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    if (toNumber(cell(row, 1)) === no) {
      return toNumber(cell(row, 24)); // X = Total
    }
  }
  return null;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
