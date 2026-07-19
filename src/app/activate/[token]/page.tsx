import { activateAccount } from "@/server/actions/activation";
import { redirect } from "next/navigation";

export default async function ActivatePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

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
      <h1 className="text-xl font-semibold mb-2">Activate your account</h1>
      <p className="text-sm text-neutral-500 mb-6">
        Set a password to access your Ramulondi Burial Society membership profile.
      </p>
      <form action={activate} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Email (optional)
          <input name="email" type="email" className="border rounded px-3 py-2 bg-transparent" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Phone
          <input name="phone" type="tel" placeholder="0821234567" className="border rounded px-3 py-2 bg-transparent" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Choose a password
          <input
            name="password"
            type="password"
            minLength={8}
            required
            className="border rounded px-3 py-2 bg-transparent"
          />
        </label>
        <button
          type="submit"
          className="bg-black text-white dark:bg-white dark:text-black rounded px-3 py-2 text-sm font-medium"
        >
          Activate account
        </button>
      </form>
    </div>
  );
}
