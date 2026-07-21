import ActionForm from "@/components/forms/ActionForm";
import Field from "@/components/forms/Field";
import { submitClaimForm } from "@/server/actions/claim";

export default function NewClaimPage() {
  return (
    <div className="max-w-lg">
      <h1 className="text-xl font-semibold mb-2">File a claim</h1>
      <p className="text-sm text-neutral-500 mb-6">
        One claim per deceased person (member or beneficiary). Admin review verifies good standing
        before approval — approval itself is what marks the member or beneficiary as deceased.
      </p>
      <ActionForm action={submitClaimForm} submitLabel="Submit claim" onSuccessMessage="Claim submitted for review.">
        <Field label="Member's Membership No" name="membershipNo" required placeholder="e.g. RAMU0001" />
        <Field
          label="Beneficiary reference No (leave blank if the deceased is the member)"
          name="beneficiaryReferenceNo"
          placeholder="e.g. RAMU0001-B01"
        />
        <Field label="Date deceased" name="dateDeceased" type="date" required />
        <label className="flex flex-col gap-1 text-sm">
          Place of burial
          <select name="placeOfBurial" required className="border rounded px-3 py-2 bg-transparent">
            <option value="KHALAVHA">Khalavha</option>
            <option value="OTHER">Community site (other)</option>
          </select>
        </label>

        <h2 className="font-medium mt-2">Payout recipient</h2>
        <Field label="First name" name="payoutRecipientName" required />
        <Field label="Surname" name="payoutRecipientSurname" required />
        <Field label="ID number" name="payoutRecipientIdNumber" required />
        <Field label="Phone" name="payoutRecipientPhone" required placeholder="0821234567" />
        <Field label="Email (optional)" name="payoutRecipientEmail" type="email" />

        <h2 className="font-medium mt-2">Banking details</h2>
        <Field label="Bank name" name="bankName" required />
        <Field label="Account number" name="bankAccountNumber" required />
      </ActionForm>
    </div>
  );
}
