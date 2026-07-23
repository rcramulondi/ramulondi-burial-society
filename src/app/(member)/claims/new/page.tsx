import { prisma } from "@/lib/prisma";
import ActionForm from "@/components/forms/ActionForm";
import Field from "@/components/forms/Field";
import SearchSelect from "@/components/ui/SearchSelect";
import BankNameField from "@/components/forms/BankNameField";
import { submitClaimForm } from "@/server/actions/claim";

export default async function NewClaimPage() {
  const [members, beneficiaries] = await Promise.all([
    prisma.member.findMany({ orderBy: { surname: "asc" } }),
    prisma.beneficiary.findMany({ where: { deletedAt: null }, include: { member: true }, orderBy: { surname: "asc" } }),
  ]);

  const memberOptions = members.map((m) => ({
    value: m.id,
    label: `${m.firstName} ${m.surname} (${m.membershipNo})`,
  }));
  const beneficiaryOptions = beneficiaries.map((b) => ({
    value: b.id,
    label: `${b.firstName} ${b.surname} — ${b.member.firstName} ${b.member.surname} (${b.referenceNo})`,
    searchText: `${b.firstName} ${b.surname} ${b.member.firstName} ${b.member.surname} ${b.referenceNo}`,
  }));

  return (
    <div className="max-w-lg">
      <h1 className="text-xl font-semibold mb-2">File a claim</h1>
      <p className="text-sm text-neutral-500 mb-6">
        One claim per deceased person (member or beneficiary). Admin review verifies good standing
        before approval — approval itself is what marks the member or beneficiary as deceased. A
        death certificate is required to submit.
      </p>
      <ActionForm action={submitClaimForm} submitLabel="Submit claim" onSuccessMessage="Claim submitted for review.">
        <label className="flex flex-col gap-1 text-sm">
          Member
          <SearchSelect name="memberId" options={memberOptions} placeholder="Search by name or membership no" required />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Beneficiary (leave blank if the deceased is the member)
          <SearchSelect name="beneficiaryId" options={beneficiaryOptions} placeholder="Search by name or reference no" />
        </label>
        <Field label="Date deceased" name="dateDeceased" type="date" required />
        <label className="flex flex-col gap-1 text-sm">
          Place of burial
          <select name="placeOfBurial" required className="border border-slate-300 rounded px-3 py-2 bg-white">
            <option value="KHALAVHA">Khalavha</option>
            <option value="OTHER">Community site (other)</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Death certificate
          <input name="deathCertificate" type="file" accept=".jpg,.jpeg,.png,.pdf" required className="text-sm" />
        </label>

        <h2 className="font-medium mt-2">Payout recipient</h2>
        <Field label="First name" name="payoutRecipientName" required />
        <Field label="Surname" name="payoutRecipientSurname" required />
        <Field label="ID number" name="payoutRecipientIdNumber" required />
        <Field label="Phone" name="payoutRecipientPhone" required placeholder="0821234567" />
        <Field label="Email (optional)" name="payoutRecipientEmail" type="email" />

        <h2 className="font-medium mt-2">Banking details</h2>
        <BankNameField />
        <Field label="Account number" name="bankAccountNumber" required />
      </ActionForm>
    </div>
  );
}
