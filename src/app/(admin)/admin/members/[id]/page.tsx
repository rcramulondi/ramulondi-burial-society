import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getMemberDetail, updateMemberForm, completeMemberDraftForm } from "@/server/actions/member";
import { uploadDocument } from "@/server/actions/document";
import { listBeneficiaries, reallocateBeneficiaryForm } from "@/server/actions/beneficiary";
import ActionForm from "@/components/forms/ActionForm";
import Field from "@/components/forms/Field";
import FieldLabel from "@/components/forms/FieldLabel";
import FormKey from "@/components/forms/FormKey";
import InviteButton from "@/components/forms/InviteButton";
import Card from "@/components/ui/Card";
import Modal from "@/components/ui/Modal";
import SearchSelect from "@/components/ui/SearchSelect";
import { formatDate, formatCurrency } from "@/lib/format";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function AdminMemberDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ edit?: string }>;
}) {
  const { id } = await params;
  const { edit } = await searchParams;
  const [session, member] = await Promise.all([auth(), getMemberDetail(id)]);
  if (!member) notFound();

  const canMaintain = session?.user.role === "ADMIN" && (session.user.adminGroup === "SUPER_ADMIN" || session.user.adminGroup === "SECRETARY");
  // Deceased members are locked from further edits (updateMember enforces
  // this too) — no point offering an Edit link that can only ever fail.
  const canEditFields = canMaintain && member.status !== "DECEASED";
  const isEditing = edit === "1" && canEditFields;
  const memberLevelClaim = member.claims.find((c) => !c.beneficiaryId);
  const canEditDeceasedDate = member.claims.length > 0;

  return (
    <div className="flex flex-col gap-8">
      {member.isDraft && (
        <Card className="max-w-lg border-amber-200 bg-amber-50">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="text-sm font-medium text-navy">This member is a draft</p>
              <p className="text-xs text-text-muted">Fill in anything missing using Edit below, then mark it complete.</p>
            </div>
            {canMaintain && (
              <ActionForm action={completeMemberDraftForm} submitLabel="Mark as complete" className="flex flex-col gap-1">
                <input type="hidden" name="memberId" value={member.id} />
              </ActionForm>
            )}
          </div>
        </Card>
      )}

      {(member.succeedsMember || member.succeededByMember) && (
        <Card className="max-w-lg">
          <h2 className="font-medium mb-2 text-navy">Succession</h2>
          <div className="text-sm flex flex-col gap-1">
            {member.succeedsMember && (
              <p>
                Succeeds{" "}
                <Link href={`/admin/members/${member.succeedsMember.id}`} className="text-accent hover:underline">
                  {member.succeedsMember.firstName} {member.succeedsMember.surname} ({member.succeedsMember.membershipNo})
                </Link>
              </p>
            )}
            {member.succeededByMember && (
              <p>
                Succeeded by{" "}
                <Link href={`/admin/members/${member.succeededByMember.id}`} className="text-accent hover:underline">
                  {member.succeededByMember.firstName} {member.succeededByMember.surname} ({member.succeededByMember.membershipNo})
                </Link>
              </p>
            )}
          </div>
        </Card>
      )}

      {member.status === "DECEASED" && (
        <Card className="max-w-lg">
          <h2 className="font-medium mb-2 text-navy">Claim details</h2>
          {memberLevelClaim ? (
            <dl className="text-sm grid grid-cols-2 gap-y-1">
              <dt className="text-neutral-500">Status</dt>
              <dd>{memberLevelClaim.status}</dd>
              <dt className="text-neutral-500">Date deceased</dt>
              <dd>{formatDate(memberLevelClaim.dateDeceased)}</dd>
              <dt className="text-neutral-500">Place of burial</dt>
              <dd>{memberLevelClaim.placeOfBurial}</dd>
              {memberLevelClaim.reviewNotes && (
                <>
                  <dt className="text-neutral-500">Review notes</dt>
                  <dd>{memberLevelClaim.reviewNotes}</dd>
                </>
              )}
              {memberLevelClaim.payout && (
                <>
                  <dt className="text-neutral-500">Payout amount</dt>
                  <dd>{formatCurrency(memberLevelClaim.payout.amount)}</dd>
                  <dt className="text-neutral-500">Paid date</dt>
                  <dd>{formatDate(memberLevelClaim.payout.paidDate)}</dd>
                </>
              )}
            </dl>
          ) : (
            <p className="text-sm text-neutral-500">No claim is on file for this member.</p>
          )}
        </Card>
      )}

      {member.status === "DECEASED" && canMaintain && (
        <DeceasedBeneficiariesSection memberId={id} />
      )}

      <Card className="max-w-lg">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-medium text-navy">Member details</h2>
          {canEditFields && !isEditing && (
            <Link href={`/admin/members/${id}?edit=1`} className="text-sm text-accent hover:underline">Edit</Link>
          )}
        </div>

        {isEditing ? (
          <>
            <ActionForm action={updateMemberForm} submitLabel="Save changes" sticky>
              <FormKey />
              <input type="hidden" name="memberId" value={member.id} />
              <Field label="First name" name="firstName" defaultValue={member.firstName} required />
              <Field label="Surname" name="surname" defaultValue={member.surname} required />
              <Field label="Phone" name="phone" defaultValue={member.phone ?? ""} required />
              <Field label="Email" name="email" type="email" defaultValue={member.email ?? ""} />
              <Field
                label="ID number"
                name="idNumber"
                defaultValue={member.idNumber ?? ""}
                helperText="13-digit South African ID number."
              />
              {canEditDeceasedDate ? (
                <Field label="Date deceased (leave blank if alive)" name="deceasedDate" type="date" defaultValue={member.deceasedDate?.toISOString().slice(0, 10) ?? ""} />
              ) : (
                <p className="text-xs text-neutral-500">
                  Date deceased can only be set once a claim has been filed for this member.
                </p>
              )}
            </ActionForm>
            <Link href={`/admin/members/${id}`} className="text-sm text-neutral-500 hover:underline mt-2 inline-block">Cancel</Link>
          </>
        ) : (
          <dl className="text-sm grid grid-cols-2 gap-y-1">
            <dt className="text-neutral-500">First name</dt>
            <dd>{member.firstName}</dd>
            <dt className="text-neutral-500">Surname</dt>
            <dd>{member.surname}</dd>
            <dt className="text-neutral-500">Phone</dt>
            <dd>{member.phone ?? "—"}</dd>
            <dt className="text-neutral-500">Email</dt>
            <dd>{member.email ?? "—"}</dd>
            <dt className="text-neutral-500">ID number</dt>
            <dd>{member.idNumber ?? "—"}</dd>
            <dt className="text-neutral-500">Date deceased</dt>
            <dd>{formatDate(member.deceasedDate)}</dd>
          </dl>
        )}
      </Card>

      <Card className="max-w-lg">
        <h2 className="font-medium mb-4 text-navy">Account access</h2>
        <InviteButton memberId={member.id} />
      </Card>

      <Card>
        <h2 className="font-medium mb-4 text-navy">Documents</h2>
        <ul className="text-sm mb-3">
          {member.documents.map((d) => (
            <li key={d.id}>
              <a href={`/api/documents/${d.id}`} target="_blank" className="text-accent hover:underline">{d.fileName}</a> ({d.ownerType})
            </li>
          ))}
          {member.documents.length === 0 && <li className="text-neutral-500">No documents uploaded.</li>}
        </ul>
        <ActionForm action={uploadDocument} submitLabel="Upload document" className="flex flex-col gap-2 max-w-sm">
          <input type="hidden" name="memberId" value={member.id} />
          <label className="flex flex-col gap-1 text-sm">
            <FieldLabel label="Document type" required />
            <select name="ownerType" required className="border border-slate-300 rounded px-3 py-2 bg-white">
              <option value="MEMBER_ID_PROOF">Member ID proof</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <FieldLabel label="File" required />
            <input name="file" type="file" accept=".jpg,.jpeg,.png,.pdf" required className="text-sm" />
          </label>
        </ActionForm>
      </Card>
    </div>
  );
}

async function DeceasedBeneficiariesSection({ memberId }: { memberId: string }) {
  const [beneficiaries, otherMembers] = await Promise.all([
    listBeneficiaries(memberId),
    prisma.member.findMany({
      where: { id: { not: memberId }, status: { not: "DECEASED" } },
      orderBy: { surname: "asc" },
    }),
  ]);

  const memberOptions = otherMembers.map((m) => ({
    value: m.id,
    label: `${m.firstName} ${m.surname} (${m.membershipNo})`,
  }));

  return (
    <Card className="max-w-lg">
      <h2 className="font-medium mb-2 text-navy">Beneficiaries</h2>
      <p className="text-xs text-neutral-500 mb-3">
        This member is deceased — their beneficiaries can be reallocated to another member&apos;s policy.
      </p>
      <ul className="flex flex-col gap-3">
        {beneficiaries.map((b) => (
          <li key={b.id} className="flex items-center justify-between text-sm border-b border-slate-100 pb-2">
            <span>{b.firstName} {b.surname} <span className="text-neutral-500">({b.relationship})</span></span>
            <Modal triggerLabel="Reallocate" title={`Reallocate ${b.firstName} ${b.surname}`}>
              <ActionForm action={reallocateBeneficiaryForm} submitLabel="Reallocate">
                <input type="hidden" name="beneficiaryId" value={b.id} />
                <label className="flex flex-col gap-1 text-sm">
                  <FieldLabel label="New member" required />
                  <SearchSelect name="newMemberId" options={memberOptions} placeholder="Search members" required />
                </label>
              </ActionForm>
            </Modal>
          </li>
        ))}
        {beneficiaries.length === 0 && <li className="text-sm text-neutral-500">No beneficiaries on record.</li>}
      </ul>
    </Card>
  );
}
