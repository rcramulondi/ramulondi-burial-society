/**
 * Renders a field's label text with a red required asterisk or a gray
 * "optional" pill immediately after it — the app-wide convention so a
 * non-technical admin never has to guess which fields are needed to submit.
 * Used both inside `Field` (native inputs) and directly by call sites that
 * supply their own `<label>` around a raw `<select>` or `<SearchSelect>`.
 */
export default function FieldLabel({ label, required }: { label: string; required?: boolean }) {
  return (
    <span className="flex items-center gap-1.5">
      {label}
      {required ? (
        <span className="text-danger font-bold" aria-hidden="true">*</span>
      ) : (
        <span className="text-[10px] font-semibold uppercase tracking-wide text-text-muted bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5">
          optional
        </span>
      )}
    </span>
  );
}
