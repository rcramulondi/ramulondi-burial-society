import Link from "next/link";
import Image from "next/image";
import { auth, signOut } from "@/lib/auth";
import HamburgerMenu from "./HamburgerMenu";

const MEMBER_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/beneficiaries", label: "Beneficiaries" },
  { href: "/contributions", label: "Contributions" },
  { href: "/claims", label: "Claims" },
  { href: "/profile", label: "Profile" },
];

const ADMIN_LINKS = [
  { href: "/admin/dashboard", label: "Dashboard" },
  { href: "/admin/members", label: "Members" },
  { href: "/admin/rates", label: "Rates" },
  { href: "/admin/claims", label: "Claims" },
  { href: "/admin/committee", label: "Committee" },
  { href: "/admin/expenses", label: "Expenses" },
  { href: "/admin/unallocated-funds", label: "Unallocated Funds" },
  { href: "/admin/reports", label: "Reports" },
  { href: "/admin/settings", label: "Settings" },
  { href: "/admin/audit-log", label: "Audit Log" },
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
