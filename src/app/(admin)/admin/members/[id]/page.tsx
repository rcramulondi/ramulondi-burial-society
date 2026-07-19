import { getMemberDetail, updateMemberForm } from "@/server/actions/member";
import { getMemberContributionSummary, recordPaymentForm } from "@/server/actions/payment";
import { uploadDocument } from "@/server/actions/document";
import { createBeneficiaryForm, deleteBeneficiaryForm } from "@/server/actions/beneficiary";
import ActionForm from "@/components/forms/ActionForm";
import Field from "@/components/forms/Field";
import DeleteButton from "@/components/forms/DeleteButton";
import InviteButton from "@/components/forms/InviteButton";
import { STATUS_LABELS } from "@/lib/statusLabels";
import { notFound } from "next/navigation";

const RELATIONSHIPS = ["FATHER", "MOTHER", "SPOUSE", "SON", "DAUGHTER", "DEPENDENT", "OTHER"];

export default async function AdminMemberDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [member, summary] = await Promise.all([getMemberDetail(id), getMemberContributionSummary(id)]);
  if (!member) notFound();

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-semibold">{member.firstName} {member.surname}</h1>
        <p className="text-sm text-neutral-500">
          {member.membershipNo} &middot; {STATUS_LABELS[member.status]} &middot; Outstanding: R {summary.outstandingBalance.toFixed(2)}
        </p>
      </div>

      <section className="max-w-lg">
        <h2 className="font-medium mb-2">Edit member</h2>
        <ActionForm action={updateMemberForm} submitLabel="Save changes">
          <input type="hidden" name="memberId" value={member.id} />
          <Field label="First name" name="firstName" defaultValue={member.firstName} required />
          <Field label="Surname" name="surname" defaultValue={member.surname} required />
          <Field label="Phone" name="phone" defaultValue={member.phone ?? ""} required />
          <Field label="Email" name="email" type="email" defaultValue={member.email ?? ""} />
          <Field label="ID number" name="idNumber" defaultValue={member.idNumber ?? ""} />
          <Field label="Date deceased (leave blank if alive)" name="deceasedDate" type="date" defaultValue={member.deceasedDate?.toISOString().slice(0, 10) ?? ""} />
        </ActionForm>
      </section>

      <section>
        <h2 className="font-medium mb-2">Account access</h2>
        <InviteButton memberId={member.id} />
      </section>

      <section className="max-w-md">
        <h2 className="font-medium mb-2">Record a payment</h2>
        <ActionForm action={recordPaymentForm} submitLabel="Record payment">
          <input type="hidden" name="memberId" value={member.id} />
          <label className="flex flex-col gap-1 text-sm">
            Category
            <select name="category" required className="border rounded px-3 py-2 bg-transparent">
              <option value="MONTHLY_CONTRIBUTION">Monthly contribution (spread across outstanding months)</option>
              <option value="JOINING_FEE">Joining fee</option>
            </select>
          </label>
          <Field label="Amount (R)" name="amount" type="number" required />
          <Field label="Payment date" name="paymentDate" type="date" required />
          <Field label="Method (optional)" name="method" placeholder="Cash, EFT, ..." />
          <Field label="Reference (optional)" name="reference" />
        </ActionForm>
      </section>

      <section>
        <h2 className="font-medium mb-2">Beneficiaries</h2>
        <table className="w-full text-sm border-collapse mb-4">
          <thead>
            <tr className="text-left border-b">
              <th className="py-1">Name</th>
              <th className="py-1">Relationship</th>
              <th className="py-1"></th>
            </tr>
          </thead>
          <tbody>
            {member.beneficiaries.map((b) => (
              <tr key={b.id} className="border-b border-black/5 dark:border-white/10">
                <td className="py-1">{b.firstName} {b.surname}</td>
                <td className="py-1">{b.relationship}</td>
                <td className="py-1">
                  <DeleteButton
                    action={deleteBeneficiaryForm}
                    hiddenFields={{ beneficiaryId: b.id }}
                    confirmMessage="Remove this beneficiary? Only one deletion is allowed per 12-month period."
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <details className="max-w-md">
          <summary className="cursor-pointer text-sm underline">Add beneficiary</summary>
          <div className="mt-3">
            <ActionForm action={createBeneficiaryForm} submitLabel="Add beneficiary">
              <input type="hidden" name="memberId" value={member.id} />
              <Field label="First name" name="firstName" required />
              <Field label="Surname" name="surname" required />
              <label className="flex flex-col gap-1 text-sm">
                Relationship
                <select name="relationship" required className="border rounded px-3 py-2 bg-transparent">
                  {RELATIONSHIPS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </label>
              <Field label="ID number (optional)" name="idNumber" />
              <Field label="Phone (optional)" name="phone" />
            </ActionForm>
          </div>
        </details>
      </section>

      <section>
        <h2 className="font-medium mb-2">Documents</h2>
        <ul className="text-sm mb-3">
          {member.documents.map((d) => (
            <li key={d.id}>
              <a href={`/api/documents/${d.id}`} target="_blank" className="underline">{d.fileName}</a> ({d.ownerType})
            </li>
          ))}
          {member.documents.length === 0 && <li className="text-neutral-500">No documents uploaded.</li>}
        </ul>
        <ActionForm action={uploadDocument} submitLabel="Upload document" className="flex flex-col gap-2 max-w-sm">
          <input type="hidden" name="memberId" value={member.id} />
          <label className="flex flex-col gap-1 text-sm">
            Document type
            <select name="ownerType" required className="border rounded px-3 py-2 bg-transparent">
              <option value="MEMBER_ID_PROOF">Member ID proof</option>
            </select>
          </label>
          <input name="file" type="file" accept=".jpg,.jpeg,.png,.pdf" required className="text-sm" />
        </ActionForm>
      </section>
    </div>
  );
}
