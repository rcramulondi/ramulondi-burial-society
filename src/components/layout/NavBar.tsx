import Link from "next/link";
import Image from "next/image";
import { auth, signOut } from "@/lib/auth";
import HamburgerMenu from "./HamburgerMenu";
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
} from "lucide-react";

const iconClass = "w-4 h-4";

const MEMBER_LINKS = [
  { href: "/dashboard", label: "Dashboard", icon: <LayoutDashboard className={iconClass} /> },
  { href: "/beneficiaries", label: "Beneficiaries", icon: <Users className={iconClass} /> },
  { href: "/contributions", label: "Contributions", icon: <Banknote className={iconClass} /> },
  { href: "/claims", label: "Claims", icon: <FileCheck2 className={iconClass} /> },
  { href: "/committee", label: "Committee", icon: <UsersRound className={iconClass} /> },
  { href: "/profile", label: "Profile", icon: <User className={iconClass} /> },
];

const ADMIN_LINKS = [
  { href: "/admin/dashboard", label: "Dashboard", icon: <LayoutDashboard className={iconClass} /> },
  { href: "/admin/members", label: "Members", icon: <Users className={iconClass} /> },
  { href: "/admin/rates", label: "Rates", icon: <Percent className={iconClass} /> },
  { href: "/admin/claims", label: "Claims", icon: <FileCheck2 className={iconClass} /> },
  { href: "/admin/committee", label: "Committee", icon: <UsersRound className={iconClass} /> },
  { href: "/admin/expenses", label: "Expenses", icon: <Receipt className={iconClass} /> },
  { href: "/admin/unallocated-funds", label: "Unallocated Funds", icon: <Coins className={iconClass} /> },
  { href: "/admin/reports", label: "Reports", icon: <FileBarChart className={iconClass} /> },
  { href: "/admin/settings", label: "Settings", icon: <Settings className={iconClass} /> },
  { href: "/admin/audit-log", label: "Audit Log", icon: <ScrollText className={iconClass} /> },
];

export default async function NavBar() {
  const session = await auth();
  if (!session?.user) return null;

  const links = session.user.role === "ADMIN" ? ADMIN_LINKS : MEMBER_LINKS;

  return (
    <header className="bg-gradient-to-r from-navy to-secondary text-white">
      <div className="mx-auto max-w-5xl flex items-center justify-between px-4 py-3 gap-4">
        <Link href="/" className="flex items-center gap-2 font-semibold whitespace-nowrap">
          <Image src="/logo.png" alt="Ramulondi Burial Society" width={32} height={32} className="rounded-full" />
          <span className="hidden sm:inline">Ramulondi Burial Society</span>
        </Link>
        <HamburgerMenu links={links}>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button type="submit" className="w-full text-left px-4 py-2 text-sm text-red-700 hover:bg-background transition-colors">
              Sign out
            </button>
          </form>
        </HamburgerMenu>
      </div>
    </header>
  );
}
