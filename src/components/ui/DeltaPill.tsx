/**
 * Green-up/red-down trend pill — always color + arrow + percentage text
 * together, never an arrow or color alone. Only render this when a genuine
 * prior-period comparison exists; there is no "no data" fallback rendering
 * on purpose, since a fabricated 0% would be misleading.
 */
export default function DeltaPill({ current, previous }: { current: number; previous: number }) {
  if (previous === 0) return null;
  const pct = ((current - previous) / previous) * 100;
  const isUp = pct >= 0;
  return (
    <span
      className={`text-xs font-bold px-2 py-0.5 rounded inline-flex items-center gap-1 ${
        isUp ? "text-success bg-success-bg" : "text-danger bg-danger-bg"
      }`}
    >
      <span aria-hidden="true">{isUp ? "▲" : "▼"}</span>
      {Math.abs(pct).toFixed(1)}%
    </span>
  );
}
