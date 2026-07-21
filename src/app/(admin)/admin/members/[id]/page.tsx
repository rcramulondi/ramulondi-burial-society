import { getMemberDetail, updateMemberForm } from "@/server/actions/member";
import { uploadDocument } from "@/server/actions/document";
import ActionForm from "@/components/forms/ActionForm";
import Field from "@/components/forms/Field";
import InviteButton from "@/components/forms/InviteButton";
import Card from "@/components/ui/Card";
import { notFound } from "next/navigation";

export default async function AdminMemberDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const member = await getMemberDetail(id);
  if (!member) notFound();

  return (
    <div className="flex flex-col gap-8">
      <Card className="max-w-lg">
        <h2 className="font-medium mb-4 text-navy">Edit member</h2>
        <ActionForm action={updateMemberForm} submitLabel="Save changes">
          <input type="hidden" name="memberId" value={member.id} />
          <Field label="First name" name="firstName" defaultValue={member.firstName} required />
          <Field label="Surname" name="surname" defaultValue={member.surname} required />
          <Field label="Phone" name="phone" defaultValue={member.phone ?? ""} required />
          <Field label="Email" name="email" type="email" defaultValue={member.email ?? ""} />
          <Field label="ID number" name="idNumber" defaultValue={member.idNumber ?? ""} />
          <Field label="Date deceased (leave blank if alive)" name="deceasedDate" type="date" defaultValue={member.deceasedDate?.toISOString().slice(0, 10) ?? ""} />
        </ActionForm>
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
            Document type
            <select name="ownerType" required className="border border-slate-300 rounded px-3 py-2 bg-white">
              <option value="MEMBER_ID_PROOF">Member ID proof</option>
            </select>
          </label>
          <input name="file" type="file" accept=".jpg,.jpeg,.png,.pdf" required className="text-sm" />
        </ActionForm>
      </Card>
    </div>
  );
}
