import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function MemberLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!session.user.memberId) {
    redirect(session.user.role === "ADMIN" ? "/admin/dashboard" : "/login");
  }
  return <>{children}</>;
}
