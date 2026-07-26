"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Desktop/tablet inline nav row (≥820px) — the counterpart to HamburgerMenu,
 * which now only renders below that breakpoint. Active link gets a gold
 * underline, matching the rebrand mockup.
 */
export default function InlineNav({
  links,
}: {
  links: { href: string; label: string; icon?: React.ReactNode }[];
}) {
  const pathname = usePathname();

  return (
    <nav className="hidden min-[820px]:flex flex-1 min-w-0 items-center gap-5 text-sm font-medium overflow-x-auto px-1 [scrollbar-width:thin]">
      {links.map((l) => {
        const isActive = pathname === l.href || pathname.startsWith(`${l.href}/`);
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`flex items-center gap-1.5 pb-1 border-b-2 whitespace-nowrap shrink-0 transition-colors ${
              isActive ? "border-gold text-white" : "border-transparent text-white/85 hover:text-white"
            }`}
          >
            {l.icon}
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
