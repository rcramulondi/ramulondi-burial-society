"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createMemberDraftForm, createMemberForm } from "@/server/actions/member";
import Field from "@/components/forms/Field";
import FieldLabel from "@/components/forms/FieldLabel";
import FormKey from "@/components/forms/FormKey";
import OptionalSection from "@/components/forms/OptionalSection";
import SearchSelect from "@/components/ui/SearchSelect";
import type { ActionResult } from "@/server/actions/member";

const sectionTitleClass = "text-xs font-bold uppercase tracking-wide text-primary-dark mt-2 pb-1 border-b border-border";

const initialState: ActionResult<{ id: string; membershipNo: string }> = { ok: true, data: null as never };

export default function NewMemberForm({
  availableToSucceed,
}: {
  availableToSucceed: { id: string; firstName: string; surname: string; membershipNo: string }[];
}) {
  const router = useRouter();
  const [draftState, draftAction, draftPending] = useActionState(
    async (_prev: typeof initialState, formData: FormData) => createMemberDraftForm(formData),
    initialState
  );
  const [continueState, continueAction, continuePending] = useActionState(
    async (_prev: typeof initialState, formData: FormData) => createMemberForm(formData),
    initialState
  );

  useEffect(() => {
    if (draftState.ok && draftState.data) {
      router.push("/admin/members");
    }
  }, [draftState, router]);

  useEffect(() => {
    if (continueState.ok && continueState.data) {
      router.push(`/admin/members/${continueState.data.id}/beneficiaries?wizard=1`);
    }
  }, [continueState, router]);

  const succeedOptions = availableToSucceed.map((m) => ({
    value: m.id,
    label: `${m.firstName} ${m.surname} (${m.membershipNo})`,
  }));

  return (
    <form action={continueAction} className="flex flex-col gap-4">
      <div className="flex gap-1.5 mb-2">
        <div className="flex-1 h-1.5 rounded bg-accent" />
        <div className="flex-1 h-1.5 rounded bg-border" />
      </div>
      <p className="text-xs text-text-muted -mt-2">Step 1 of 2 — Member details</p>

      <FormKey />

      <h2 className={sectionTitleClass}>Member details</h2>
      <Field label="First name" name="firstName" required />
      <Field label="Surname" name="surname" required />
      <label className="flex flex-col gap-1 text-sm">
        <FieldLabel label="Gender" required />
        <select name="gender" required className="border border-slate-300 rounded px-3 py-2 bg-white">
          <option value="MALE">Male</option>
          <option value="FEMALE">Female</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <FieldLabel label="Membership type" required />
        <select name="type" required className="border border-slate-300 rounded px-3 py-2 bg-white">
          <option value="MAIN">Main</option>
          <option value="KHADZI">Khadzi</option>
        </select>
      </label>
      <Field label="Date joined" name="dateJoined" type="date" required helperText="Required to continue — can be left blank for a draft." />
      <Field label="Phone" name="phone" required placeholder="0821234567" helperText="Required to continue — can be left blank for a draft." />

      <OptionalSection>
        <Field label="Email" name="email" type="email" />
        <Field label="ID number" name="idNumber" helperText="13-digit South African ID number." />
        <Field label="Package note" name="packageNote" />
        <label className="flex flex-col gap-1 text-sm">
          <FieldLabel label="Succeeds deceased member" />
          <SearchSelect name="succeedsMemberId" placeholder="Search by name or membership no" options={succeedOptions} />
        </label>
      </OptionalSection>

      <div className="sticky bottom-0 bg-card border-t border-border pt-3 pb-1 -mx-4 px-4 flex flex-col gap-2">
        {!draftState.ok && (
          <p className="text-sm text-danger border border-danger/30 bg-danger-bg rounded p-2">{draftState.error}</p>
        )}
        {!continueState.ok && (
          <p className="text-sm text-danger border border-danger/30 bg-danger-bg rounded p-2">{continueState.error}</p>
        )}
        <div className="flex gap-3">
          <button
            type="submit"
            formAction={draftAction}
            formNoValidate
            disabled={draftPending || continuePending}
            className="flex-1 border border-slate-300 rounded px-3 py-2 text-sm font-medium bg-white hover:bg-slate-50 disabled:opacity-50"
          >
            {draftPending ? "Saving..." : "Save as draft"}
          </button>
          <button
            type="submit"
            formAction={continueAction}
            disabled={draftPending || continuePending}
            className="flex-1 bg-accent text-white rounded px-3 py-2 text-sm font-medium hover:brightness-95 transition disabled:opacity-50"
          >
            {continuePending ? "Saving..." : "Continue →"}
          </button>
        </div>
      </div>
    </form>
  );
}
