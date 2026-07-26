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
  sticky,
}: {
  action: FormAction;
  children: React.ReactNode;
  submitLabel?: string;
  onSuccessMessage?: string;
  className?: string;
  /** Pins the button (and any inline error/success message) to the bottom of the viewport — for long forms where the primary action would otherwise scroll out of reach. */
  sticky?: boolean;
}) {
  const [state, formAction, isPending] = useActionState(async (_prev: ActionResult<unknown>, formData: FormData) => {
    return action(formData);
  }, initialState);

  const button = (
    <button
      type="submit"
      disabled={isPending}
      className="bg-accent text-white rounded px-3 py-2 text-sm font-medium disabled:opacity-50 w-fit hover:brightness-95 transition"
    >
      {isPending ? "Saving..." : submitLabel}
    </button>
  );

  const messages = (
    <>
      {!state.ok && (
        <p className="text-sm text-danger border border-danger/30 bg-danger-bg rounded p-2">
          {state.error}
        </p>
      )}
      {state.ok && state.data !== null && (
        <p className="text-sm text-success">{onSuccessMessage}</p>
      )}
    </>
  );

  return (
    <form action={formAction} className={className ?? "flex flex-col gap-4"}>
      {children}
      {sticky ? (
        <div className="sticky bottom-0 bg-card border-t border-border pt-3 pb-1 -mx-4 px-4 flex flex-col gap-2">
          {messages}
          {button}
        </div>
      ) : (
        <>
          {messages}
          {button}
        </>
      )}
    </form>
  );
}
