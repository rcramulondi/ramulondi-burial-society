import { auth } from "@/lib/auth";
import { listBeneficiaries } from "@/server/actions/beneficiary";
import ActionForm from "@/components/forms/ActionForm";
import Field from "@/components/forms/Field";
import DeleteButton from "@/components/forms/DeleteButton";
import Modal from "@/components/ui/Modal";
import { BeneficiaryStatusBadge } from "@/components/ui/StatusBadge";
import { createBeneficiaryForm, deleteBeneficiaryForm, updateBeneficiaryForm } from "@/server/actions/beneficiary";

const RELATIONSHIPS = ["FATHER", "MOTHER", "SPOUSE", "SON", "DAUGHTER", "DEPENDENT", "OTHER"];

export default async function BeneficiariesPage() {
  const session = await auth();
  const memberId = session!.user.memberId!;
  const beneficiaries = await listBeneficiaries(memberId);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Beneficiaries</h1>
        <Modal triggerLabel="New beneficiary" title="Add a beneficiary">
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
              <select name="relationship" required className="border border-slate-300 rounded px-3 py-2 bg-white">
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
        </Modal>
      </div>

      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-left border-b">
            <th className="py-1">Name</th>
            <th className="py-1">Relationship</th>
            <th className="py-1">Reference No</th>
            <th className="py-1">Status</th>
            <th className="py-1"></th>
          </tr>
        </thead>
        <tbody>
          {beneficiaries.map((b) => (
            <tr key={b.id} className="border-b border-black/5">
              <td className="py-1">{b.firstName} {b.surname}</td>
              <td className="py-1">{b.relationship}</td>
              <td className="py-1">{b.referenceNo}</td>
              <td className="py-1"><BeneficiaryStatusBadge status={b.status} /></td>
              <td className="py-1">
                <div className="flex items-center gap-3">
                  {b.status !== "DECEASED" && (
                    <Modal triggerLabel="Edit" title={`Edit ${b.firstName} ${b.surname}`}>
                      <ActionForm action={updateBeneficiaryForm} submitLabel="Save changes" onSuccessMessage="Beneficiary updated.">
                        <input type="hidden" name="beneficiaryId" value={b.id} />
                        <Field label="First name" name="firstName" defaultValue={b.firstName} required />
                        <Field label="Surname" name="surname" defaultValue={b.surname} required />
                        <label className="flex flex-col gap-1 text-sm">
                          Relationship
                          <select name="relationship" defaultValue={b.relationship} required className="border border-slate-300 rounded px-3 py-2 bg-white">
                            {RELATIONSHIPS.map((r) => (
                              <option key={r} value={r}>{r}</option>
                            ))}
                          </select>
                        </label>
                        <Field label="ID number" name="idNumber" defaultValue={b.idNumber ?? ""} required />
                        <Field label="Phone (optional)" name="phone" defaultValue={b.phone ?? ""} />
                        <Field label="Email (optional)" name="email" type="email" defaultValue={b.email ?? ""} />
                        <Field label="Date of birth (optional)" name="dateOfBirth" type="date" defaultValue={b.dateOfBirth?.toISOString().slice(0, 10) ?? ""} />
                        <label className="flex items-center gap-2 text-sm">
                          <input type="checkbox" name="isDisabled" defaultChecked={b.isDisabled} />
                          Dependent has a disability (covered beyond age 25)
                        </label>
                      </ActionForm>
                    </Modal>
                  )}
                  <DeleteButton
                    action={deleteBeneficiaryForm}
                    hiddenFields={{ beneficiaryId: b.id }}
                    confirmMessage="Remove this beneficiary? You can only do this once every 12 months."
                  />
                </div>
              </td>
            </tr>
          ))}
          {beneficiaries.length === 0 && (
            <tr>
              <td colSpan={5} className="py-2 text-neutral-500">No beneficiaries yet.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
