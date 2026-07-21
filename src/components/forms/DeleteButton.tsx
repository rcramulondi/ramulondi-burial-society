"use client";

import { useActionState } from "react";
import type { ActionResult } from "@/server/actions/member";

type FormAction = (formData: FormData) => Promise<ActionResult<unknown>>;

const initialState: ActionResult<unknown> = { ok: true, data: null };

export default function DeleteButton({
  action,
  hiddenFields,
  label = "Remove",
  confirmMessage,
}: {
  action: FormAction;
  hiddenFields: Record<string, string>;
  label?: string;
  confirmMessage?: string;
}) {
  const [state, formAction, isPending] = useActionState(async (_prev: ActionResult<unknown>, formData: FormData) => {
    if (confirmMessage && typeof window !== "undefined" && !window.confirm(confirmMessage)) {
      return { ok: true, data: null } as ActionResult<unknown>;
    }
    return action(formData);
  }, initialState);

  return (
    <form action={formAction} className="inline-block">
      {Object.entries(hiddenFields).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <button
        type="submit"
        disabled={isPending}
        className="text-red-700 text-xs hover:underline disabled:opacity-50"
      >
        {isPending ? "Removing..." : label}
      </button>
      {!state.ok && <p className="text-xs text-red-700 mt-1">{state.error}</p>}
    </form>
  );
}
