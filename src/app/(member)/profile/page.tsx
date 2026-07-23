import { auth } from "@/lib/auth";
import { getMemberDetail, updateMemberForm } from "@/server/actions/member";
import { uploadDocument } from "@/server/actions/document";
import { upsertPayoutNomineeForm } from "@/server/actions/payoutNominee";
import ActionForm from "@/components/forms/ActionForm";
import Field from "@/components/forms/Field";
import { MemberStatusBadge } from "@/components/ui/StatusBadge";

export default async function ProfilePage() {
  const session = await auth();
  const memberId = session!.user.memberId!;
  const member = await getMemberDetail(memberId);
  if (!member) return <p>Member record not found.</p>;

  return (
    <div className="flex flex-col gap-8 max-w-lg">
      <div>
        <h1 className="text-xl font-semibold">My profile</h1>
        <dl className="text-sm mt-4 grid grid-cols-2 gap-y-1">
          <dt className="text-neutral-500">Membership No</dt>
          <dd>{member.membershipNo}</dd>
          <dt className="text-neutral-500">Name</dt>
          <dd>{member.firstName} {member.surname}</dd>
          <dt className="text-neutral-500">Type</dt>
          <dd>{member.type}</dd>
          <dt className="text-neutral-500">Status</dt>
          <dd><MemberStatusBadge status={member.status} /></dd>
          <dt className="text-neutral-500">Date joined</dt>
          <dd>{member.dateJoined.toDateString()}</dd>
          <dt className="text-neutral-500">ID Number</dt>
          <dd>{member.idNumber ? `•••• •••• ${member.idNumber.slice(-4)}` : "Not on file — please add it below"}</dd>
        </dl>
        {(member.succeedsMember || member.succeededByMember) && (
          <p className="text-xs text-neutral-500 mt-2">
            {member.succeedsMember && `Succeeds ${member.succeedsMember.firstName} ${member.succeedsMember.surname} (${member.succeedsMember.membershipNo}). `}
            {member.succeededByMember && `Succeeded by ${member.succeededByMember.firstName} ${member.succeededByMember.surname} (${member.succeededByMember.membershipNo}).`}
          </p>
        )}
      </div>

      <section>
        <h2 className="font-medium mb-2">Contact details</h2>
        <ActionForm action={updateMemberForm} submitLabel="Update contact details">
          <input type="hidden" name="memberId" value={memberId} />
          <Field label="Phone" name="phone" defaultValue={member.phone ?? ""} required />
          <Field label="Email" name="email" type="email" defaultValue={member.email ?? ""} />
          {!member.idNumber && <Field label="ID number" name="idNumber" />}
        </ActionForm>
      </section>

      <section>
        <h2 className="font-medium mb-2">Proof of identification</h2>
        <ul className="text-sm mb-3">
          {member.documents.filter((d) => d.ownerType === "MEMBER_ID_PROOF").map((d) => (
            <li key={d.id}>
              <a href={`/api/documents/${d.id}`} target="_blank" className="underline">{d.fileName}</a>
            </li>
          ))}
        </ul>
        <ActionForm action={uploadDocument} submitLabel="Upload document" onSuccessMessage="Document uploaded.">
          <input type="hidden" name="memberId" value={memberId} />
          <input type="hidden" name="ownerType" value="MEMBER_ID_PROOF" />
          <label className="flex flex-col gap-1 text-sm">
            File (JPEG, PNG, or PDF, max 5MB)
            <input name="file" type="file" accept=".jpg,.jpeg,.png,.pdf" required className="text-sm" />
          </label>
        </ActionForm>
      </section>

      <section>
        <h2 className="font-medium mb-2">Nominated payout recipient (optional)</h2>
        <p className="text-xs text-neutral-500 mb-3">
          Who should receive the payout on your behalf if a claim is made.
        </p>
        <ActionForm action={upsertPayoutNomineeForm} submitLabel="Save nominee">
          <input type="hidden" name="memberId" value={memberId} />
          <Field label="First name" name="firstName" defaultValue={member.payoutNominee?.firstName ?? ""} required />
          <Field label="Surname" name="surname" defaultValue={member.payoutNominee?.surname ?? ""} required />
          <Field label="Phone" name="phone" defaultValue={member.payoutNominee?.phone ?? ""} required />
          <Field label="Bank name" name="bankName" defaultValue={member.payoutNominee?.bankName ?? ""} required />
          <Field label="Account number" name="accountNumber" defaultValue={member.payoutNominee?.accountNumber ?? ""} required />
        </ActionForm>
      </section>
    </div>
  );
}
