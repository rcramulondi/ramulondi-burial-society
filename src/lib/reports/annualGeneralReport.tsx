import "server-only";
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/prisma";
import { ReportHeader, ReportFooter, REPORT_COLORS } from "./pdfLayout";

const styles = StyleSheet.create({
  page: { padding: 40, paddingBottom: 90, fontSize: 11, fontFamily: "Helvetica" },
  sectionTitle: { fontSize: 13, fontWeight: 700, color: REPORT_COLORS.navy, marginTop: 16, marginBottom: 8 },
  label: { fontSize: 9, color: "#64748b" },
  value: { fontSize: 12, marginTop: 2, marginBottom: 4, color: REPORT_COLORS.navy },
  table: { marginTop: 4, borderTopWidth: 1, borderTopColor: REPORT_COLORS.navy },
  tableRow: { flexDirection: "row", paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: REPORT_COLORS.border },
  totalRow: { flexDirection: "row", paddingVertical: 6, borderTopWidth: 1, borderTopColor: REPORT_COLORS.navy },
  cell: { flex: 1, fontSize: 10, color: REPORT_COLORS.navy },
  cellHeader: { flex: 1, fontSize: 10, fontWeight: 700, color: REPORT_COLORS.navy },
  netPositive: { fontSize: 14, fontWeight: 700, color: REPORT_COLORS.accent, marginTop: 12 },
  netNegative: { fontSize: 14, fontWeight: 700, color: "#dc2626", marginTop: 12 },
});

/**
 * Admin-only: annual general report — income (contributions collected) vs.
 * expenditure (recorded expenses + claim payouts) for the year, for AGM
 * reporting purposes.
 */
export async function generateAnnualGeneralReport(year: number): Promise<Buffer> {
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

  const expenseTotal = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const claimPayoutTotal = claimPayouts.reduce((s, p) => s + Number(p.amount), 0);
  const totalExpenditure = expenseTotal + claimPayoutTotal;

  const net = totalIncome - totalExpenditure;

  const doc = (
    <Document>
      <Page size="A4" style={styles.page}>
        <ReportHeader subtitle={`Annual General Report — ${year}`} />

        <Text style={styles.sectionTitle}>Income</Text>
        <View style={styles.table}>
          <View style={styles.tableRow}>
            <Text style={styles.cell}>Burial fund contributions</Text>
            <Text style={styles.cell}>R {burialIncome.toFixed(2)}</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.cell}>Food fund contributions</Text>
            <Text style={styles.cell}>R {foodIncome.toFixed(2)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.cellHeader}>Total income</Text>
            <Text style={styles.cellHeader}>R {totalIncome.toFixed(2)}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Expenditure</Text>
        <View style={styles.table}>
          <View style={styles.tableRow}>
            <Text style={styles.cell}>Recorded expenses ({expenses.length})</Text>
            <Text style={styles.cell}>R {expenseTotal.toFixed(2)}</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.cell}>Claim payouts ({claimPayouts.length})</Text>
            <Text style={styles.cell}>R {claimPayoutTotal.toFixed(2)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.cellHeader}>Total expenditure</Text>
            <Text style={styles.cellHeader}>R {totalExpenditure.toFixed(2)}</Text>
          </View>
        </View>

        <Text style={net >= 0 ? styles.netPositive : styles.netNegative}>
          Net {net >= 0 ? "surplus" : "deficit"} for {year}: R {Math.abs(net).toFixed(2)}
        </Text>

        <ReportFooter />
      </Page>
    </Document>
  );

  return renderToBuffer(doc);
}
