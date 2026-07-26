"use client";

import { useState } from "react";

/**
 * Collapsible panel for optional/later fields on longer forms — collapsed by
 * default so the form only shows what's needed to save a record, with
 * everything else one tap away. Matches the "Add more details (optional)"
 * pattern from the rebrand spec.
 */
export default function OptionalSection({
  label = "Add more details (optional)",
  children,
}: {
  label?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="my-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-between bg-primary-light text-primary-dark rounded-lg px-3 py-2.5 text-sm font-semibold"
      >
        <span>{open ? "Hide optional details" : label}</span>
        <span aria-hidden="true">{open ? "▴" : "▾"}</span>
      </button>
      {open && <div className="flex flex-col gap-4 mt-4">{children}</div>}
    </div>
  );
}
