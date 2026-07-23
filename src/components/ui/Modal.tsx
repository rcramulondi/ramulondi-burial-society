"use client";

import { useState, useEffect } from "react";

export default function Modal({
  triggerLabel,
  title,
  children,
}: {
  triggerLabel: string;
  title: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="bg-accent text-white rounded px-3 py-2 text-sm font-medium hover:brightness-95 transition w-fit"
      >
        {triggerLabel}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="relative bg-card border border-slate-200 rounded-xl shadow-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-medium text-navy">{title}</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="text-neutral-500 hover:text-navy text-xl leading-none"
              >
                &times;
              </button>
            </div>
            {children}
          </div>
        </div>
      )}
    </>
  );
}
