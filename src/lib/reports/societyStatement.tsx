import "server-only";
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/prisma";
import { ReportHeader, ReportFooter, REPORT_COLORS } from "./pdfLayout";

const styles = StyleSheet.create({
  page: { padding: 40, paddingBottom: 90, fontSize: 10, fontFamily: "Helvetica" },
  label: { fontSize: 9, color: "#64748b", marginBottom: 12 },
  table: { marginTop: 8, borderTopWidth: 1, borderTopColor: REPORT_COLORS.navy },
  tableHeader: { flexDirection: "row", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: REPORT_COLORS.navy },
  tableRow: { flexDirection: "row", paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: REPORT_COLORS.border },
  cellHeader: { flex: 1, fontSize: 9, fontWeight: 700, color: REPORT_COLORS.navy },
  cell: { flex: 1, fontSize: 9, color: REPORT_COLORS.navy },
  totalRow: { flexDirection: "row", paddingVertical: 6, borderTopWidth: 1, borderTopColor: REPORT_COLORS.navy },
});

/** Admin-only: every member's contribution total for the year, in one statement. */
export async function generateSocietyStatement(year: number): Promise<Buffer> {
  const [members, allocations] = await Promise.all([
    prisma.member.findMany({ orderBy: { surname: "asc" } }),
    prisma.paymentAllocation.findMany({ where: { year } }),
  ]);

  const rows = members
    .map((m) => {
      const memberAllocations = allocations.filter((a) => a.memberId === m.id);
      const burial = memberAllocations.filter((a) => a.fund === "BURIAL").reduce((s, a) => s + Number(a.amount), 0);
      const food = memberAllocations.filter((a) => a.fund === "FOOD").reduce((s, a) => s + Number(a.amount), 0);
      return { member: m, burial, food, total: burial + food };
    })
    .filter((r) => r.total > 0);

  const grandTotal = rows.reduce((s, r) => s + r.total, 0);

  const doc = (
    <Document>
      <Page size="A4" style={styles.page}>
        <ReportHeader subtitle={`Society Statement of Contributions — ${year}`} />
        <Text style={styles.label}>{rows.length} contributing member(s) for {year}.</Text>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.cellHeader}>Membership No</Text>
            <Text style={styles.cellHeader}>Name</Text>
            <Text style={styles.cellHeader}>Burial fund</Text>
            <Text style={styles.cellHeader}>Food fund</Text>
            <Text style={styles.cellHeader}>Total</Text>
          </View>
          {rows.map((r) => (
            <View style={styles.tableRow} key={r.member.id}>
              <Text style={styles.cell}>{r.member.membershipNo}</Text>
              <Text style={styles.cell}>{r.member.firstName} {r.member.surname}</Text>
              <Text style={styles.cell}>R {r.burial.toFixed(2)}</Text>
              <Text style={styles.cell}>R {r.food.toFixed(2)}</Text>
              <Text style={styles.cell}>R {r.total.toFixed(2)}</Text>
            </View>
          ))}
          <View style={styles.totalRow}>
            <Text style={styles.cellHeader}>Total</Text>
            <Text style={styles.cellHeader} />
            <Text style={styles.cellHeader} />
            <Text style={styles.cellHeader} />
            <Text style={styles.cellHeader}>R {grandTotal.toFixed(2)}</Text>
          </View>
        </View>

        <ReportFooter />
      </Page>
    </Document>
  );

  return renderToBuffer(doc);
}
