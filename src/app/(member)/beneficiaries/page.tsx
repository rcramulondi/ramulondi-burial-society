import { auth } from "@/lib/auth";
import { listBeneficiaries } from "@/server/actions/beneficiary";
import ActionForm from "@/components/forms/ActionForm";
import Field from "@/components/forms/Field";
import DeleteButton from "@/components/forms/DeleteButton";
import { createBeneficiaryForm, deleteBeneficiaryForm } from "@/server/actions/beneficiary";

const RELATIONSHIPS = ["FATHER", "MOTHER", "SPOUSE", "SON", "DAUGHTER", "DEPENDENT", "OTHER"];

export default async function BeneficiariesPage() {
  const session = await auth();
  const memberId = session!.user.memberId!;
  const beneficiaries = await listBeneficiaries(memberId);

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-xl font-semibold">Beneficiaries</h1>

      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-left border-b">
            <th className="py-1">Name</th>
            <th className="py-1">Relationship</th>
            <th className="py-1">Reference No</th>
            <th className="py-1"></th>
          </tr>
        </thead>
        <tbody>
          {beneficiaries.map((b) => (
            <tr key={b.id} className="border-b border-black/5 dark:border-white/10">
              <td className="py-1">{b.firstName} {b.surname}</td>
              <td className="py-1">{b.relationship}</td>
              <td className="py-1">{b.referenceNo}</td>
              <td className="py-1">
                <DeleteButton
                  action={deleteBeneficiaryForm}
                  hiddenFields={{ beneficiaryId: b.id }}
                  confirmMessage="Remove this beneficiary? You can only do this once every 12 months."
                />
              </td>
            </tr>
          ))}
          {beneficiaries.length === 0 && (
            <tr>
              <td colSpan={4} className="py-2 text-neutral-500">No beneficiaries yet.</td>
            </tr>
          )}
        </tbody>
      </table>

      <div className="border rounded-lg p-4 max-w-md">
        <h2 className="font-medium mb-4">Add a beneficiary</h2>
        <p className="text-xs text-neutral-500 mb-4">
          Only one Father and one Mother can be recorded per member. Beneficiaries can only be
          removed once every 12 months.
        </p>
        <ActionForm action={createBeneficiaryForm} submitLabel="Add beneficiary" onSuccessMessage="Beneficiary added.">
          <input type="hidden" name="memberId" value={memberId} />
          <Field label="First name" name="firstName" required />
          <Field label="Surname" name="surname" required />
          <label className="flex flex-col gap-1 text-sm">
            Relationship
            <select name="relationship" required className="border rounded px-3 py-2 bg-transparent">
              {RELATIONSHIPS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </label>
          <Field label="ID number" name="idNumber" required />
          <Field label="Phone (optional)" name="phone" />
          <Field label="Email (optional)" name="email" type="email" />
          <Field label="Date of birth (optional)" name="dateOfBirth" type="date" />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="isDisabled" />
            Dependent has a disability (covered beyond age 25)
          </label>
        </ActionForm>
      </div>
    </div>
  );
}
