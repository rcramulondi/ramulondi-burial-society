import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Shared income/expenditure split for a year — "burial expenditure" is
 * claim payouts (every payout in this app is a burial payout), "other
 * expenses" is the Expense table. Used by both the Annual General Report PDF
 * and the admin dashboard's on-screen tiles, so the split is only computed
 * in one place.
 */
export async function getAnnualFinancialSummary(year: number) {
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const yearEnd = new Date(Date.UTC(year + 1, 0, 1));

  const [allocations, expenses, claimPayouts] = await Promise.all([
    prisma.paymentAllocation.groupBy({ by: ["fund"], where: { year }, _sum: { amount: true } }),
    prisma.expense.findMany({ where: { expenseDate: { gte: yearStart, lt: yearEnd } } }),
    prisma.claimPayout.findMany({ where: { paidDate: { gte: yearStart, lt: yearEnd } } }),
  ]);

  const burialIncome = Number(allocations.find((a) => a.fund === "BURIAL")?._sum.amount ?? 0);
  const foodIncome = Number(allocations.find((a) => a.fund === "FOOD")?._sum.amount ?? 0);
  const totalIncome = burialIncome + foodIncome;

  const otherExpenseTotal = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const burialExpenditureTotal = claimPayouts.reduce((s, p) => s + Number(p.amount), 0);
  const totalExpenditure = otherExpenseTotal + burialExpenditureTotal;

  return {
    burialIncome,
    foodIncome,
    totalIncome,
    otherExpenseCount: expenses.length,
    otherExpenseTotal,
    claimPayoutCount: claimPayouts.length,
    burialExpenditureTotal,
    totalExpenditure,
    net: totalIncome - totalExpenditure,
  };
}
