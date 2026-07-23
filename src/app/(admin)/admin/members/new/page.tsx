import { prisma } from "@/lib/prisma";
import ActionForm from "@/components/forms/ActionForm";
import Field from "@/components/forms/Field";
import SearchSelect from "@/components/ui/SearchSelect";
import { createMemberForm } from "@/server/actions/member";

export default async function NewMemberPage() {
  const availableToSucceed = await prisma.member.findMany({
    where: { status: "DECEASED", succeededByMember: null },
    orderBy: { surname: "asc" },
  });

  return (
    <div className="max-w-lg">
      <h1 className="text-xl font-semibold mb-6">Add a new member</h1>
      <ActionForm action={createMemberForm} submitLabel="Create member" onSuccessMessage="Member created.">
        <Field label="First name" name="firstName" required />
        <Field label="Surname" name="surname" required />
        <label className="flex flex-col gap-1 text-sm">
          Gender
          <select name="gender" required className="border rounded px-3 py-2 bg-transparent">
            <option value="MALE">Male</option>
            <option value="FEMALE">Female</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Membership type
          <select name="type" required className="border rounded px-3 py-2 bg-transparent">
            <option value="MAIN">Main</option>
            <option value="KHADZI">Khadzi</option>
          </select>
        </label>
        <Field label="Date joined" name="dateJoined" type="date" required />
        <Field label="Phone" name="phone" required placeholder="0821234567" />
        <Field label="Email (optional)" name="email" type="email" />
        <Field label="ID number (optional)" name="idNumber" />
        <Field label="Package note (optional)" name="packageNote" />
        <label className="flex flex-col gap-1 text-sm">
          Succeeds deceased member (optional)
          <SearchSelect
            name="succeedsMemberId"
            placeholder="Search by name or membership no"
            options={availableToSucceed.map((m) => ({
              value: m.id,
              label: `${m.firstName} ${m.surname} (${m.membershipNo})`,
            }))}
          />
        </label>
      </ActionForm>
    </div>
  );
}
