import FieldLabel from "./FieldLabel";

export default function Field({
  label,
  name,
  type = "text",
  required,
  defaultValue,
  placeholder,
  helperText,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  defaultValue?: string;
  placeholder?: string;
  helperText?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <FieldLabel label={label} required={required} />
      <input
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="border border-slate-300 rounded px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
      />
      {helperText && <span className="text-xs text-text-muted">{helperText}</span>}
    </label>
  );
}
