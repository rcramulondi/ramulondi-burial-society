/**
 * One-line legend explaining the required/optional convention, shown once at
 * the top of any form with 4+ fields so admins never have to be told or
 * guess — matches the "* = required to submit / optional = can be added
 * later" key from the rebrand spec.
 */
export default function FormKey() {
  return (
    <div className="flex flex-wrap gap-4 text-xs text-text-muted bg-background rounded-lg px-3 py-2 mb-2">
      <span className="flex items-center gap-1">
        <span className="text-danger font-bold">*</span> = required to submit
      </span>
      <span className="flex items-center gap-1">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-text-muted bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5">optional</span>
        = can be added later
      </span>
    </div>
  );
}
