import "server-only";
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/prisma";
import { ReportHeader, ReportFooter, REPORT_COLORS } from "./pdfLayout";

const styles = StyleSheet.create({
  page: { padding: 40, paddingBottom: 90, fontSize: 11, fontFamily: "Helvetica" },
  label: { fontSize: 9, color: "#64748b" },
  value: { fontSize: 12, marginTop: 2, marginBottom: 10, color: REPORT_COLORS.navy },
  section: { marginBottom: 4 },
  table: { marginTop: 8, borderTopWidth: 1, borderTopColor: REPORT_COLORS.navy },
  tableHeader: { flexDirection: "row", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: REPORT_COLORS.navy },
  tableRow: { flexDirection: "row", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: REPORT_COLORS.border },
  cellHeader: { flex: 1, fontSize: 9, fontWeight: 700, color: REPORT_COLORS.navy },
  cell: { flex: 1, fontSize: 10, color: REPORT_COLORS.navy },
  totalRow: { flexDirection: "row", paddingVertical: 6, borderTopWidth: 1, borderTopColor: REPORT_COLORS.navy },
});

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** A member's own annual statement of contributions, by month and fund. */
export async function generateContributionStatement(memberId: string, year: number): Promise<Buffer> {
  const [member, allocations] = await Promise.all([
    prisma.member.findUniqueOrThrow({ where: { id: memberId } }),
    prisma.paymentAllocation.findMany({ where: { memberId, year }, orderBy: { month: "asc" } }),
  ]);

  const rows = Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;
    const burial = allocations.filter((a) => a.month === month && a.fund === "BURIAL").reduce((s, a) => s + Number(a.amount), 0);
    const food = allocations.filter((a) => a.month === month && a.fund === "FOOD").reduce((s, a) => s + Number(a.amount), 0);
    return { month, monthName: MONTH_NAMES[i], burial, food, total: burial + food };
  });
  const yearTotal = rows.reduce((s, r) => s + r.total, 0);

  const doc = (
    <Document>
      <Page size="A4" style={styles.page}>
        <ReportHeader subtitle={`Statement of Contributions — ${year}`} />

        <View style={styles.section}>
          <Text style={styles.label}>Member</Text>
          <Text style={styles.value}>
            {member.firstName} {member.surname} ({member.membershipNo})
          </Text>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.cellHeader}>Month</Text>
            <Text style={styles.cellHeader}>Burial fund</Text>
            <Text style={styles.cellHeader}>Food fund</Text>
            <Text style={styles.cellHeader}>Total</Text>
          </View>
          {rows.map((r) => (
            <View style={styles.tableRow} key={r.month}>
              <Text style={styles.cell}>{r.monthName}</Text>
              <Text style={styles.cell}>R {r.burial.toFixed(2)}</Text>
              <Text style={styles.cell}>R {r.food.toFixed(2)}</Text>
              <Text style={styles.cell}>R {r.total.toFixed(2)}</Text>
            </View>
          ))}
          <View style={styles.totalRow}>
            <Text style={styles.cellHeader}>Total for {year}</Text>
            <Text style={styles.cellHeader} />
            <Text style={styles.cellHeader} />
            <Text style={styles.cellHeader}>R {yearTotal.toFixed(2)}</Text>
          </View>
        </View>

        <ReportFooter />
      </Page>
    </Document>
  );

  return renderToBuffer(doc);
}
