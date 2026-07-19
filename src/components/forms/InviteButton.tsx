"use client";

import { useActionState } from "react";
import { inviteMember } from "@/server/actions/activation";
import type { ActionResult } from "@/server/actions/member";

const initialState: ActionResult<{ token: string }> = { ok: true, data: { token: "" } };

export default function InviteButton({ memberId }: { memberId: string }) {
  const [state, formAction, isPending] = useActionState(
    async () => inviteMember(memberId),
    initialState
  );

  const link = state.ok && state.data.token
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/activate/${state.data.token}`
    : null;

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <button
        type="submit"
        disabled={isPending}
        className="border rounded px-3 py-2 text-sm w-fit disabled:opacity-50"
      >
        {isPending ? "Generating..." : "Generate activation link"}
      </button>
      {!state.ok && <p className="text-sm text-red-700 dark:text-red-400">{state.error}</p>}
      {link && (
        <p className="text-xs break-all">
          Send this link to the member (WhatsApp/SMS/in person): <span className="underline">{link}</span>
        </p>
      )}
    </form>
  );
}
