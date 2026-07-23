import { listBeneficiaries, createBeneficiaryForm, deleteBeneficiaryForm, updateBeneficiaryForm, updateBeneficiaryStatusForm } from "@/server/actions/beneficiary";
import { BENEFICIARY_STATUS_LABELS } from "@/lib/statusLabels";
import { BeneficiaryStatusBadge } from "@/components/ui/StatusBadge";
import ActionForm from "@/components/forms/ActionForm";
import Field from "@/components/forms/Field";
import DeleteButton from "@/components/forms/DeleteButton";
import Card from "@/components/ui/Card";
import Modal from "@/components/ui/Modal";

const RELATIONSHIPS = ["FATHER", "MOTHER", "SPOUSE", "SON", "DAUGHTER", "DEPENDENT", "OTHER"];
const STATUS_OPTIONS = ["ACTIVE", "INACTIVE"] as const;

export default async function MemberBeneficiariesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: memberId } = await params;
  const beneficiaries = await listBeneficiaries(memberId);

  return (
    <div className="flex flex-col gap-8">
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-medium text-navy">Beneficiaries</h2>
          <Modal triggerLabel="New beneficiary" title="Add a beneficiary">
            <p className="text-xs text-neutral-500 mb-4">
              Only one Father and one Mother can be recorded per member. A beneficiary already recorded
              as deceased cannot be re-registered.
            </p>
            <ActionForm action={createBeneficiaryForm} submitLabel="Add beneficiary">
              <input type="hidden" name="memberId" value={memberId} />
              <Field label="First name" name="firstName" required />
              <Field label="Surname" name="surname" required />
              <label className="flex flex-col gap-1 text-sm">
                Relationship
                <select name="relationship" required className="border border-slate-300 rounded px-3 py-2 bg-white">
                  {RELATIONSHIPS.map((r) => <option key={r} value={r}>{r}</option>)}
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
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left border-b border-slate-200">
                <th className="py-1 pr-3">Name</th>
                <th className="py-1 pr-3">Relationship</th>
                <th className="py-1 pr-3">Reference No</th>
                <th className="py-1 pr-3">ID number</th>
                <th className="py-1 pr-3">Status</th>
                <th className="py-1 pr-3"></th>
              </tr>
            </thead>
            <tbody>
              {beneficiaries.map((b) => (
                <tr key={b.id} className="border-b border-slate-100 align-top">
                  <td className="py-2 pr-3">{b.firstName} {b.surname}</td>
                  <td className="py-2 pr-3">{b.relationship}</td>
                  <td className="py-2 pr-3">{b.referenceNo}</td>
                  <td className="py-2 pr-3">
                    {b.idNumber ?? (
                      <span className="text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 text-xs">Missing ID</span>
                    )}
                  </td>
                  <td className="py-2 pr-3">
                    {b.status === "DECEASED" ? (
                      <BeneficiaryStatusBadge status={b.status} />
                    ) : (
                      <ActionForm
                        action={updateBeneficiaryStatusForm}
                        submitLabel="Update"
                        onSuccessMessage="Status updated."
                        className="flex gap-1 items-center"
                      >
                        <input type="hidden" name="beneficiaryId" value={b.id} />
                        <select name="status" defaultValue={b.status} className="border border-slate-300 rounded px-2 py-1 text-xs bg-white">
                          {STATUS_OPTIONS.map((s) => (
                            <option key={s} value={s}>{BENEFICIARY_STATUS_LABELS[s]}</option>
                          ))}
                          <option value="DECEASED">{BENEFICIARY_STATUS_LABELS.DECEASED}</option>
                        </select>
                      </ActionForm>
                    )}
                  </td>
                  <td className="py-2 pr-3">
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
                                {RELATIONSHIPS.map((r) => <option key={r} value={r}>{r}</option>)}
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
                        confirmMessage="Remove this beneficiary? Only one deletion is allowed per 12-month period."
                      />
                    </div>
                  </td>
                </tr>
              ))}
              {beneficiaries.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-2 text-neutral-500">No beneficiaries yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
