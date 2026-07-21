import "server-only";
import { Image, Text, View, StyleSheet } from "@react-pdf/renderer";
import fs from "fs";
import path from "path";

const logoBuffer = fs.readFileSync(path.join(process.cwd(), "public", "logo.png"));

export const REPORT_COLORS = {
  navy: "#073B4C",
  accent: "#52B788",
  muted: "#64748b",
  border: "#e2e8f0",
};

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", marginBottom: 24 },
  logo: { width: 48, height: 48, borderRadius: 24 },
  titleBlock: { marginLeft: 12 },
  title: { fontSize: 18, fontWeight: 700, color: REPORT_COLORS.navy },
  subtitle: { fontSize: 10, color: REPORT_COLORS.accent, marginTop: 2 },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    borderTopWidth: 1,
    borderTopColor: REPORT_COLORS.border,
    paddingTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  footerText: { fontSize: 8, color: REPORT_COLORS.muted },
  signatureBlock: { alignItems: "center" },
  signatureLine: { borderTopWidth: 1, borderTopColor: REPORT_COLORS.navy, width: 120, marginBottom: 2 },
  stampBox: {
    borderWidth: 1,
    borderColor: REPORT_COLORS.navy,
    borderStyle: "dashed",
    padding: 6,
    alignItems: "center",
    justifyContent: "center",
    width: 120,
  },
  stampText: { fontSize: 7, color: REPORT_COLORS.navy, textAlign: "center" },
});

export function ReportHeader({ subtitle }: { subtitle: string }) {
  return (
    <View style={styles.header}>
      <Image src={{ data: logoBuffer, format: "png" }} style={styles.logo} />
      <View style={styles.titleBlock}>
        <Text style={styles.title}>Ramulondi Burial Society</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
    </View>
  );
}

/**
 * Fixed footer repeated on every page: generated timestamp, a text-based
 * treasurer signature line, and a text-based "official stamp" placeholder —
 * no real signature/stamp image assets exist yet; both are easy to swap for
 * real images later without changing callers.
 */
export function ReportFooter() {
  return (
    <View style={styles.footer} fixed>
      <Text style={styles.footerText}>Generated {new Date().toLocaleString("en-ZA")}</Text>
      <View style={styles.signatureBlock}>
        <View style={styles.signatureLine} />
        <Text style={styles.footerText}>Treasurer</Text>
      </View>
      <View style={styles.stampBox}>
        <Text style={styles.stampText}>RAMULONDI BURIAL SOCIETY{"\n"}OFFICIAL STAMP</Text>
      </View>
    </View>
  );
}
