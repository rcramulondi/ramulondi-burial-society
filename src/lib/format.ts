/**
 * Shared display formatters for every screen — dd/mm/yyyy dates and
 * "R #,##0.00" currency, so formatting stays consistent without each page
 * hand-rolling toDateString()/toFixed(2). Dates are read via UTC getters
 * since Prisma DateTime values are stored as UTC midnight and most of the
 * app already treats them that way (see e.g. memberStatus.ts) — using local
 * getters here would risk shifting the displayed day depending on server
 * timezone.
 */

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "—";
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = d.getUTCFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export function formatCurrency(amount: number | string | { toString(): string } | null | undefined): string {
  const n = Number(amount ?? 0);
  return `R ${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * dd/mm/yyyy, HH:MM — for a true timestamp (e.g. "submitted at"), unlike
 * `formatDate` which is deliberately date-only/UTC-midnight-safe and would
 * be wrong here. Uses local time getters since these are real moment-in-time
 * values (createdAt/reviewedAt), not UTC-midnight-stored calendar dates.
 */
export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "—";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${yyyy}, ${hh}:${min}`;
}
