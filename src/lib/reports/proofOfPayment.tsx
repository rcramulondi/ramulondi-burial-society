import "server-only";
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/prisma";
import { ReportHeader, ReportFooter } from "./pdfLayout";

const styles = StyleSheet.create({
  page: { padding: 40, paddingBottom: 90, fontSize: 11, fontFamily: "Helvetica" },
  label: { fontSize: 9, color: "#64748b" },
  value: { fontSize: 12, marginTop: 2, marginBottom: 10, color: "#073B4C" },
  section: { marginBottom: 4 },
  table: { marginTop: 8, borderTopWidth: 1, borderTopColor: "#073B4C" },
  tableHeader: { flexDirection: "row", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: "#073B4C" },
  tableRow: { flexDirection: "row", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: "#e2e8f0" },
  cellHeader: { flex: 1, fontSize: 9, fontWeight: 700, color: "#073B4C" },
  cell: { flex: 1, fontSize: 10, color: "#073B4C" },
});

const CATEGORY_LABELS: Record<string, string> = {
  MONTHLY_CONTRIBUTION: "Monthly contribution",
  JOINING_FEE: "Joining fee",
};

/**
 * Renders a proof-of-payment receipt from live Payment/PaymentAllocation
 * data on demand (not persisted as a Document row, so it always reflects
 * the current allocation state). Returns a delivery-agnostic Buffer so the
 * download route and a future "email to member" action can both reuse it
 * without touching this function.
 */
export async function generateProofOfPaymentPdf(paymentId: string): Promise<Buffer> {
  const payment = await prisma.payment.findUniqueOrThrow({
    where: { id: paymentId },
    include: {
      member: true,
      allocations: { orderBy: [{ year: "asc" }, { month: "asc" }] },
    },
  });

  const doc = (
    <Document>
      <Page size="A4" style={styles.page}>
        <ReportHeader subtitle="Proof of Payment" />

        <View style={styles.section}>
          <Text style={styles.label}>Payment date</Text>
          <Text style={styles.value}>{payment.paymentDate.toDateString()}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Member</Text>
          <Text style={styles.value}>
            {payment.member.firstName} {payment.member.surname} ({payment.member.membershipNo})
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Category</Text>
          <Text style={styles.value}>{CATEGORY_LABELS[payment.category] ?? payment.category}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Amount received</Text>
          <Text style={styles.value}>R {Number(payment.amount).toFixed(2)}</Text>
        </View>

        {payment.method && (
          <View style={styles.section}>
            <Text style={styles.label}>Method</Text>
            <Text style={styles.value}>{payment.method}</Text>
          </View>
        )}

        {payment.reference && (
          <View style={styles.section}>
            <Text style={styles.label}>Reference</Text>
            <Text style={styles.value}>{payment.reference}</Text>
          </View>
        )}

        {payment.allocations.length > 0 && (
          <View>
            <Text style={styles.label}>Allocation breakdown</Text>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={styles.cellHeader}>Period</Text>
                <Text style={styles.cellHeader}>Fund</Text>
                <Text style={styles.cellHeader}>Amount</Text>
              </View>
              {payment.allocations.map((a) => (
                <View style={styles.tableRow} key={a.id}>
                  <Text style={styles.cell}>{a.year}-{String(a.month).padStart(2, "0")}</Text>
                  <Text style={styles.cell}>{a.fund}</Text>
                  <Text style={styles.cell}>R {Number(a.amount).toFixed(2)}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <ReportFooter />
      </Page>
    </Document>
  );

  return renderToBuffer(doc);
}
