import "server-only";
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/prisma";
import { ReportHeader, ReportFooter, REPORT_COLORS, getActiveCommitteeRoster } from "./pdfLayout";
import { RELATIONSHIP_LABELS } from "@/lib/statusLabels";

const styles = StyleSheet.create({
  page: { padding: 40, paddingBottom: 130, fontSize: 11, fontFamily: "Helvetica" },
  sectionTitle: { fontSize: 13, fontWeight: 700, color: REPORT_COLORS.navy, marginTop: 16, marginBottom: 8 },
  label: { fontSize: 9, color: REPORT_COLORS.muted },
  value: { fontSize: 12, marginTop: 2, marginBottom: 10, color: REPORT_COLORS.navy },
  section: { marginBottom: 4 },
});

/**
 * Regenerated live from Claim/ClaimPayout on every request (not persisted
 * as a Document row) — same pattern as generateProofOfPaymentPdf, so it
 * always reflects the current record and stays reprintable indefinitely via
 * the download route.
 */
export async function generateClaimPayoutProofPdf(claimId: string): Promise<Buffer> {
  const [claim, committee] = await Promise.all([
    prisma.claim.findUniqueOrThrow({
      where: { id: claimId },
      include: { member: true, beneficiary: true, payout: true },
    }),
    getActiveCommitteeRoster(),
  ]);

  if (!claim.payout) {
    throw new Error("No payout has been recorded for this claim yet.");
  }

  const deceasedName = claim.beneficiary
    ? `${claim.beneficiary.firstName} ${claim.beneficiary.surname}`
    : `${claim.member.firstName} ${claim.member.surname}`;
  const deceasedReference = claim.beneficiary ? claim.beneficiary.referenceNo : claim.member.membershipNo;
  const relationship = claim.beneficiary ? RELATIONSHIP_LABELS[claim.beneficiary.relationship] : "Member (policyholder)";
  const burialLocation = claim.placeOfBurial === "KHALAVHA" ? "Khalavha" : "Community site (other)";

  const doc = (
    <Document>
      <Page size="A4" style={styles.page}>
        <ReportHeader subtitle="Claim Payout — Proof of Payment" />

        <Text style={styles.sectionTitle}>Deceased</Text>
        <View style={styles.section}>
          <Text style={styles.label}>Name</Text>
          <Text style={styles.value}>{deceasedName}</Text>
        </View>
        <View style={styles.section}>
          <Text style={styles.label}>Reference number</Text>
          <Text style={styles.value}>{deceasedReference}</Text>
        </View>
        <View style={styles.section}>
          <Text style={styles.label}>Relationship to member</Text>
          <Text style={styles.value}>{relationship}</Text>
        </View>
        <View style={styles.section}>
          <Text style={styles.label}>Member</Text>
          <Text style={styles.value}>
            {claim.member.firstName} {claim.member.surname} ({claim.member.membershipNo})
          </Text>
        </View>
        <View style={styles.section}>
          <Text style={styles.label}>Date deceased</Text>
          <Text style={styles.value}>{claim.dateDeceased.toDateString()}</Text>
        </View>
        <View style={styles.section}>
          <Text style={styles.label}>Place of burial</Text>
          <Text style={styles.value}>{burialLocation}</Text>
        </View>

        <Text style={styles.sectionTitle}>Paid to</Text>
        <View style={styles.section}>
          <Text style={styles.label}>Recipient</Text>
          <Text style={styles.value}>
            {claim.payoutRecipientName} {claim.payoutRecipientSurname}
          </Text>
        </View>
        <View style={styles.section}>
          <Text style={styles.label}>ID number</Text>
          <Text style={styles.value}>{claim.payoutRecipientIdNumber}</Text>
        </View>
        <View style={styles.section}>
          <Text style={styles.label}>Bank details</Text>
          <Text style={styles.value}>{claim.bankName} — {claim.bankAccountNumber}</Text>
        </View>

        <Text style={styles.sectionTitle}>Payout</Text>
        <View style={styles.section}>
          <Text style={styles.label}>Amount paid</Text>
          <Text style={styles.value}>R {Number(claim.payout.amount).toFixed(2)}</Text>
        </View>
        <View style={styles.section}>
          <Text style={styles.label}>Paid date</Text>
          <Text style={styles.value}>{claim.payout.paidDate.toDateString()}</Text>
        </View>
        <View style={styles.section}>
          <Text style={styles.label}>Paid to</Text>
          <Text style={styles.value}>{claim.payout.paidTo}</Text>
        </View>

        <ReportFooter committee={committee} />
      </Page>
    </Document>
  );

  return renderToBuffer(doc);
}
