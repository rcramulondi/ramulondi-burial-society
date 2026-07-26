import { activateAccount } from "@/server/actions/activation";
import { redirect } from "next/navigation";
import FieldLabel from "@/components/forms/FieldLabel";

export default async function ActivatePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { token } = await params;
  const { error } = await searchParams;

  async function activate(formData: FormData) {
    "use server";
    const result = await activateAccount({
      token,
      password: formData.get("password"),
      email: formData.get("email") || undefined,
      phone: formData.get("phone") || undefined,
    });
    if (!result.ok) {
      redirect(`/activate/${token}?error=${encodeURIComponent(result.error)}`);
    }
    redirect("/login");
  }

  return (
    <div className="max-w-sm mx-auto mt-12">
      <h1 className="text-xl font-semibold mb-2 text-navy">Activate your account</h1>
      <p className="text-sm text-neutral-500 mb-6">
        Set a password to access your Ramulondi Burial Society membership profile.
      </p>
      {error && (
        <p className="mb-4 text-sm text-danger border border-danger/30 bg-danger-bg rounded p-2">
          {error}
        </p>
      )}
      <form action={activate} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <FieldLabel label="Email" />
          <input name="email" type="email" className="border border-slate-300 rounded px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <FieldLabel label="Phone" />
          <input name="phone" type="tel" placeholder="0821234567" className="border border-slate-300 rounded px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <FieldLabel label="Choose a password" required />
          <input
            name="password"
            type="password"
            minLength={8}
            required
            className="border border-slate-300 rounded px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
          />
          <span className="text-xs text-text-muted">At least 8 characters.</span>
        </label>
        <button
          type="submit"
          className="bg-accent text-white rounded px-3 py-2 text-sm font-medium hover:brightness-95 transition"
        >
          Activate account
        </button>
      </form>
    </div>
  );
}
