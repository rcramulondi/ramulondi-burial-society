"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { filterOptions, type SearchSelectOption } from "@/lib/searchSelect";

export default function SearchSelect({
  name,
  options,
  defaultValue,
  placeholder,
  required,
}: {
  name: string;
  options: SearchSelectOption[];
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
}) {
  const defaultOption = options.find((o) => o.value === defaultValue);
  const [query, setQuery] = useState(defaultOption?.label ?? "");
  const [selectedId, setSelectedId] = useState(defaultValue ?? "");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => filterOptions(options, query), [options, query]);

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onMouseDown);
    return () => window.removeEventListener("mousedown", onMouseDown);
  }, [open]);

  return (
    <div className="relative" ref={containerRef}>
      <input type="hidden" name={name} value={selectedId} required={required} />
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setSelectedId("");
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        autoComplete="off"
        className="border border-slate-300 rounded px-3 py-2 bg-white w-full focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
      />
      {open && filtered.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full max-h-48 overflow-y-auto bg-card border border-slate-200 rounded shadow-lg">
          {filtered.slice(0, 20).map((o) => (
            <li key={o.value}>
              <button
                type="button"
                onClick={() => {
                  setSelectedId(o.value);
                  setQuery(o.label);
                  setOpen(false);
                }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-background transition-colors"
              >
                {o.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
