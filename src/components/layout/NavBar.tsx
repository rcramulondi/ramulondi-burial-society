import Link from "next/link";
import Image from "next/image";
import { auth, signOut } from "@/lib/auth";
import HamburgerMenu from "./HamburgerMenu";
import InlineNav from "./InlineNav";
import {
  LayoutDashboard,
  Users,
  Banknote,
  Percent,
  FileCheck2,
  UsersRound,
  Receipt,
  Coins,
  FileBarChart,
  Settings,
  ScrollText,
  User,
  ShieldCheck,
} from "lucide-react";
import type { AdminGroup } from "@prisma/client";

const iconClass = "w-4 h-4";

const MEMBER_LINKS = [
  { href: "/dashboard", label: "Dashboard", icon: <LayoutDashboard className={iconClass} /> },
  { href: "/beneficiaries", label: "Beneficiaries", icon: <Users className={iconClass} /> },
  { href: "/contributions", label: "Contributions", icon: <Banknote className={iconClass} /> },
  { href: "/claims", label: "Claims", icon: <FileCheck2 className={iconClass} /> },
  { href: "/committee", label: "Committee", icon: <UsersRound className={iconClass} /> },
  { href: "/profile", label: "Profile", icon: <User className={iconClass} /> },
];

/** `groups: undefined` means visible to every admin group; otherwise restricted to the listed groups. */
const ADMIN_LINKS: { href: string; label: string; icon: React.ReactNode; groups?: AdminGroup[] }[] = [
  { href: "/admin/dashboard", label: "Dashboard", icon: <LayoutDashboard className={iconClass} /> },
  { href: "/admin/members", label: "Members", icon: <Users className={iconClass} /> },
  { href: "/admin/rates", label: "Rates", icon: <Percent className={iconClass} />, groups: ["SUPER_ADMIN"] },
  { href: "/admin/claims", label: "Claims", icon: <FileCheck2 className={iconClass} /> },
  { href: "/admin/committee", label: "Committee", icon: <UsersRound className={iconClass} /> },
  { href: "/admin/expenses", label: "Expenses", icon: <Receipt className={iconClass} />, groups: ["SUPER_ADMIN", "TREASURER"] },
  { href: "/admin/unallocated-funds", label: "Unallocated Funds", icon: <Coins className={iconClass} />, groups: ["SUPER_ADMIN", "TREASURER"] },
  { href: "/admin/reports", label: "Reports", icon: <FileBarChart className={iconClass} /> },
  { href: "/admin/users", label: "Manage Users", icon: <ShieldCheck className={iconClass} />, groups: ["SUPER_ADMIN"] },
  { href: "/admin/settings", label: "Settings", icon: <Settings className={iconClass} />, groups: ["SUPER_ADMIN"] },
  { href: "/admin/audit-log", label: "Audit Log", icon: <ScrollText className={iconClass} />, groups: ["SUPER_ADMIN"] },
];

function initialsFor(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0][0]!.toUpperCase();
  return (parts[0][0]! + parts[parts.length - 1][0]!).toUpperCase();
}

export default async function NavBar() {
  const session = await auth();
  if (!session?.user) return null;

  const isAdmin = session.user.role === "ADMIN";
  let links = isAdmin ? ADMIN_LINKS.filter((l) => !l.groups || l.groups.includes(session.user.adminGroup!)) : MEMBER_LINKS;

  if (isAdmin && session.user.memberId) {
    links = [...links, { href: "/profile", label: "Profile", icon: <User className={iconClass} /> }];
  }

  const signOutForm = (
    <form
      action={async () => {
        "use server";
        await signOut({ redirectTo: "/login" });
      }}
    >
      <button type="submit" className="w-full text-left px-4 py-2 text-sm text-danger hover:bg-background transition-colors">
        Sign out
      </button>
    </form>
  );

  return (
    <header className="bg-gradient-to-r from-navy to-secondary text-white">
      <div className="mx-auto max-w-5xl flex items-center justify-between px-4 py-3 gap-4">
        <Link href="/" className="flex items-center gap-2 font-semibold whitespace-nowrap shrink-0">
          <Image src="/logo.png" alt="Ramulondi Burial Society" width={32} height={32} className="rounded-full" />
          <span className="hidden sm:inline">Ramulondi Burial Society</span>
        </Link>

        <InlineNav links={links} />

        <div className="flex items-center gap-4 shrink-0">
          <div className="hidden min-[820px]:flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gold text-navy flex items-center justify-center text-xs font-bold" title={session.user.name ?? undefined}>
              {initialsFor(session.user.name)}
            </div>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/login" });
              }}
            >
              <button type="submit" className="text-sm font-medium text-white/85 hover:text-white transition-colors">
                Sign out
              </button>
            </form>
          </div>
          <HamburgerMenu links={links} className="min-[820px]:hidden">
            {signOutForm}
          </HamburgerMenu>
        </div>
      </div>
    </header>
  );
}
