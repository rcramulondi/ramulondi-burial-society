import { prisma } from "@/lib/prisma";
import NewMemberForm from "./NewMemberForm";

export default async function NewMemberPage() {
  const availableToSucceed = await prisma.member.findMany({
    where: { status: "DECEASED", succeededByMember: null },
    orderBy: { surname: "asc" },
  });

  return (
    <div className="max-w-lg">
      <h1 className="text-xl font-semibold mb-2 text-navy">Add a new member</h1>
      <NewMemberForm availableToSucceed={availableToSucceed} />
    </div>
  );
}
