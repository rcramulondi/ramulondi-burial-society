import { signIn } from "@/lib/auth";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  async function login(formData: FormData) {
    "use server";
    try {
      await signIn("credentials", {
        identifier: formData.get("identifier"),
        password: formData.get("password"),
        redirectTo: "/post-login",
      });
    } catch (e) {
      if (e instanceof AuthError) {
        const message = e.cause?.err?.message ?? "Invalid email/phone or password.";
        redirect(`/login?error=${encodeURIComponent(message)}`);
      }
      throw e;
    }
  }

  return (
    <div className="max-w-sm mx-auto mt-12">
      <h1 className="text-xl font-semibold mb-6">Sign in</h1>
      {error && (
        <p className="mb-4 text-sm text-red-700 dark:text-red-400 border border-red-300 dark:border-red-800 rounded p-2">
          {error}
        </p>
      )}
      <form action={login} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Email or phone
          <input
            name="identifier"
            type="text"
            required
            className="border rounded px-3 py-2 bg-transparent"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Password
          <input
            name="password"
            type="password"
            required
            className="border rounded px-3 py-2 bg-transparent"
          />
        </label>
        <button
          type="submit"
          className="bg-black text-white dark:bg-white dark:text-black rounded px-3 py-2 text-sm font-medium"
        >
          Sign in
        </button>
      </form>
      <p className="mt-4 text-sm text-neutral-500">
        New member? Ask an admin for your activation link.
      </p>
    </div>
  );
}
