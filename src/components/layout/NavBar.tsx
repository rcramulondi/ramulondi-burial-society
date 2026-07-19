import Link from "next/link";
import { auth, signOut } from "@/lib/auth";

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
  { href: "/admin/settings", label: "Settings" },
  { href: "/admin/audit-log", label: "Audit Log" },
];

export default async function NavBar() {
  const session = await auth();
  if (!session?.user) return null;

  const links = session.user.role === "ADMIN" ? ADMIN_LINKS : MEMBER_LINKS;

  return (
    <header className="border-b border-black/10 dark:border-white/10">
      <div className="mx-auto max-w-5xl flex items-center justify-between px-4 py-3 gap-4">
        <Link href="/" className="font-semibold whitespace-nowrap">
          Ramulondi Burial Society
        </Link>
        <nav className="flex flex-wrap gap-4 text-sm">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="hover:underline">
              {l.label}
            </Link>
          ))}
        </nav>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
        >
          <button type="submit" className="text-sm text-red-700 dark:text-red-400 hover:underline">
            Sign out
          </button>
        </form>
      </div>
    </header>
  );
}
