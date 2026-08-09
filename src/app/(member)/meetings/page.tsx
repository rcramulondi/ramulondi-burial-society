import { listMeetings } from "@/server/actions/meeting";
import { MEETING_TYPE_LABELS } from "@/lib/statusLabels";
import { formatDate } from "@/lib/format";

export default async function MemberMeetingsPage() {
  const meetings = await listMeetings();
  const today = new Date();
  const upcoming = meetings.filter((m) => m.date >= today).sort((a, b) => a.date.getTime() - b.date.getTime());
  const past = meetings.filter((m) => m.date < today);

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-xl font-semibold">Meetings</h1>

      <section>
        <h2 className="font-medium mb-2">Upcoming meetings</h2>
        <MeetingList meetings={upcoming} emptyLabel="No upcoming meetings scheduled." />
      </section>

      <section>
        <h2 className="font-medium mb-2">Past meetings</h2>
        <MeetingList meetings={past} emptyLabel="No past meetings on record." />
      </section>
    </div>
  );
}

type MeetingRow = Awaited<ReturnType<typeof listMeetings>>[number];

function MeetingList({ meetings, emptyLabel }: { meetings: MeetingRow[]; emptyLabel: string }) {
  if (meetings.length === 0) {
    return <p className="text-sm text-neutral-500">{emptyLabel}</p>;
  }
  return (
    <ul className="flex flex-col gap-3">
      {meetings.map((m) => (
        <li key={m.id} className="border rounded p-3 text-sm">
          <p className="font-medium">{MEETING_TYPE_LABELS[m.type]}</p>
          <p className="text-neutral-500">
            {formatDate(m.date)} &middot; {m.venue} &middot; Hosted by {m.hostMember.firstName} {m.hostMember.surname}
          </p>
          {m.documents.length > 0 && (
            <ul className="mt-1 flex flex-col gap-1">
              {m.documents.map((d) => (
                <li key={d.id}>
                  <a href={`/api/documents/${d.id}`} target="_blank" className="underline text-xs">
                    {d.fileName}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  );
}
