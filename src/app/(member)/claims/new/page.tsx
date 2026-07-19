import ActionForm from "@/components/forms/ActionForm";
import Field from "@/components/forms/Field";
import { submitClaimForm } from "@/server/actions/claim";

export default function NewClaimPage() {
  return (
    <div className="max-w-lg">
      <h1 className="text-xl font-semibold mb-2">File a claim</h1>
      <p className="text-sm text-neutral-500 mb-6">
        One claim per deceased member. The member must already be recorded as deceased by an admin
        before a claim can be filed — contact the Secretary if that hasn&apos;t happened yet.
      </p>
      <ActionForm action={submitClaimForm} submitLabel="Submit claim" onSuccessMessage="Claim submitted for review.">
        <Field label="Deceased member's Membership No" name="membershipNo" required placeholder="e.g. RAMU0001" />
        <Field label="Date deceased" name="dateDeceased" type="date" required />

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
