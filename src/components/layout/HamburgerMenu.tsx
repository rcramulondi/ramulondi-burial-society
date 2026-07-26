"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function HamburgerMenu({
  links,
  children,
}: {
  links: { href: string; label: string; icon?: React.ReactNode }[];
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close on route change rather than in the Link's own onClick — closing
  // synchronously from the click handler unmounts the anchor mid-click,
  // before Next's router can complete the navigation it just started.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        className="flex flex-col justify-center gap-1.5 w-9 h-9 -mr-2 items-center"
      >
        <span className={`block h-0.5 w-6 bg-white transition-transform ${open ? "translate-y-2 rotate-45" : ""}`} />
        <span className={`block h-0.5 w-6 bg-white transition-opacity ${open ? "opacity-0" : ""}`} />
        <span className={`block h-0.5 w-6 bg-white transition-transform ${open ? "-translate-y-2 -rotate-45" : ""}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <nav className="absolute right-0 top-full mt-2 w-64 bg-card border border-slate-200 rounded-lg shadow-lg py-2 flex flex-col z-50">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="flex items-center gap-2 px-4 py-2 text-sm text-navy hover:bg-background transition-colors"
              >
                {l.icon}
                {l.label}
              </Link>
            ))}
            <div className="border-t border-slate-200 my-1" />
            {children}
          </nav>
        </>
      )}
    </div>
  );
}
