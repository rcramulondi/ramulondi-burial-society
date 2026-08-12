import "server-only";
import { Image, Text, View, StyleSheet } from "@react-pdf/renderer";
import fs from "fs";
import path from "path";
import { prisma } from "@/lib/prisma";
import { CommitteeRole } from "@prisma/client";

const logoBuffer = fs.readFileSync(path.join(process.cwd(), "public", "logo.png"));
const stampBuffer = fs.readFileSync(path.join(process.cwd(), "public", "digital stamp.png"));

export const REPORT_COLORS = {
  navy: "#073B4C",
  accent: "#52B788",
  muted: "#64748b",
  border: "#e2e8f0",
};

// Mirrors the executive committee listing on Ramulondi_Burial_Society_Letterhead.docx
const COMMITTEE_ROLE_ORDER: CommitteeRole[] = [
  "CHAIRPERSON",
  "VICE_CHAIR",
  "SECRETARY",
  "VICE_SECRETARY",
  "TREASURER",
  "ADDITIONAL_MEMBER",
  "ADDITIONAL_MEMBER_2",
  "YOUTH_COORDINATOR",
];

const COMMITTEE_ROLE_LABELS: Record<CommitteeRole, string> = {
  CHAIRPERSON: "Chairperson",
  VICE_CHAIR: "Vice Chairperson",
  SECRETARY: "Secretary",
  VICE_SECRETARY: "Vice Secretary",
  TREASURER: "Treasurer",
  ADDITIONAL_MEMBER: "Additional Member",
  ADDITIONAL_MEMBER_2: "Additional Member",
  YOUTH_COORDINATOR: "Youth Coordinator",
};

export type CommitteeRosterEntry = { label: string; name: string };

/**
 * Every generated document lists the currently active executive committee
 * (CommitteeTerm rows with no endDate) rather than names baked into a
 * template, so documents stay correct as committee membership changes.
 */
export async function getActiveCommitteeRoster(): Promise<CommitteeRosterEntry[]> {
  const terms = await prisma.committeeTerm.findMany({
    where: { endDate: null },
    include: { member: true },
  });
  const byRole = new Map(terms.map((t) => [t.role, t]));
  return COMMITTEE_ROLE_ORDER.filter((role) => byRole.has(role)).map((role) => {
    const term = byRole.get(role)!;
    return { label: COMMITTEE_ROLE_LABELS[role], name: `${term.member.firstName} ${term.member.surname}` };
  });
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", marginBottom: 24 },
  logo: { width: 48, height: 48, borderRadius: 24 },
  titleBlock: { marginLeft: 12 },
  title: { fontSize: 18, fontWeight: 700, color: REPORT_COLORS.navy },
  subtitle: { fontSize: 10, color: REPORT_COLORS.accent, marginTop: 2 },
  address: { fontSize: 8, color: REPORT_COLORS.muted, marginTop: 2 },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    borderTopWidth: 1,
    borderTopColor: REPORT_COLORS.border,
    paddingTop: 8,
  },
  committeeHeading: { fontSize: 7, fontWeight: 700, color: REPORT_COLORS.navy, letterSpacing: 0.5 },
  committeeList: { fontSize: 7, color: REPORT_COLORS.muted, marginTop: 2, lineHeight: 1.4 },
  footerBottomRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginTop: 8 },
  footerAddress: { fontSize: 8, color: REPORT_COLORS.muted },
  stampBlock: { alignItems: "center" },
  stampImage: { width: 40, height: 40 },
  stampText: { fontSize: 6, color: REPORT_COLORS.navy, marginTop: 2, textAlign: "center" },
});

export function ReportHeader({ subtitle }: { subtitle: string }) {
  return (
    <View style={styles.header}>
      <Image src={{ data: logoBuffer, format: "png" }} style={styles.logo} />
      <View style={styles.titleBlock}>
        <Text style={styles.title}>Ramulondi Burial Society</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
        <Text style={styles.address}>PO Box 797, Sibasa, 0970</Text>
      </View>
    </View>
  );
}

/**
 * Fixed footer repeated on every page: the active executive committee
 * roster (never hardcoded — see getActiveCommitteeRoster) and a digital
 * stamp bearing the society's official seal with the generation date and
 * time printed beneath it, standing in for a wet-ink signature/stamp.
 */
export function ReportFooter({ committee }: { committee: CommitteeRosterEntry[] }) {
  const now = new Date();
  const committeeLine = committee.map((c) => `${c.label}: ${c.name}`).join("   |   ");
  return (
    <View style={styles.footer} fixed>
      <Text style={styles.committeeHeading}>EXECUTIVE COMMITTEE</Text>
      <Text style={styles.committeeList}>{committeeLine}</Text>
      <View style={styles.footerBottomRow}>
        <Text style={styles.footerAddress}>Ramulondi Burial Society — PO Box 797, Sibasa, 0970</Text>
        <View style={styles.stampBlock}>
          <Image src={{ data: stampBuffer, format: "png" }} style={styles.stampImage} />
          <Text style={styles.stampText}>
            Date: {now.toLocaleDateString("en-ZA")}
            {"\n"}Time: {now.toLocaleTimeString("en-ZA")}
          </Text>
        </View>
      </View>
    </View>
  );
}
