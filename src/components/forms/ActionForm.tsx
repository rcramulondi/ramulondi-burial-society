"use client";

import { useActionState } from "react";
import type { ActionResult } from "@/server/actions/member";

type FormAction = (formData: FormData) => Promise<ActionResult<unknown>>;

const initialState: ActionResult<unknown> = { ok: true, data: null };

export default function ActionForm({
  action,
  children,
  submitLabel = "Save",
  onSuccessMessage = "Saved.",
  className,
}: {
  action: FormAction;
  children: React.ReactNode;
  submitLabel?: string;
  onSuccessMessage?: string;
  className?: string;
}) {
  const [state, formAction, isPending] = useActionState(async (_prev: ActionResult<unknown>, formData: FormData) => {
    return action(formData);
  }, initialState);

  return (
    <form action={formAction} className={className ?? "flex flex-col gap-4"}>
      {children}
      {!state.ok && (
        <p className="text-sm text-red-700 border border-red-300 bg-red-50 rounded p-2">
          {state.error}
        </p>
      )}
      {state.ok && state.data !== null && (
        <p className="text-sm text-green-700">{onSuccessMessage}</p>
      )}
      <button
        type="submit"
        disabled={isPending}
        className="bg-accent text-white rounded px-3 py-2 text-sm font-medium disabled:opacity-50 w-fit hover:brightness-95 transition"
      >
        {isPending ? "Saving..." : submitLabel}
      </button>
    </form>
  );
}
