import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function PostLoginPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  redirect(session.user.role === "ADMIN" ? "/admin/dashboard" : "/dashboard");
}
