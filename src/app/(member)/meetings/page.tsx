import { listMeetings, listPastMeetings, countPastMeetings } from "@/server/actions/meeting";
import { MEETING_TYPE_LABELS } from "@/lib/statusLabels";
import { formatDate } from "@/lib/format";
import { parsePage, totalPageCount } from "@/lib/pagination";
import Pagination from "@/components/ui/Pagination";

export default async function MemberMeetingsPage({
  searchParams,
}: {
  searchParams: Promise<{ pastSearch?: string; pastPage?: string }>;
}) {
  const { pastSearch, pastPage: pastPageParam } = await searchParams;
  const pastPage = parsePage(pastPageParam);

  const [meetings, past, pastTotal] = await Promise.all([
    listMeetings(),
    listPastMeetings({ search: pastSearch, page: pastPage }),
    countPastMeetings({ search: pastSearch }),
  ]);
  const pastTotalPages = totalPageCount(pastTotal, 20);

  const today = new Date();
  const upcoming = meetings.filter((m) => m.date >= today).sort((a, b) => a.date.getTime() - b.date.getTime());

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-xl font-semibold">Meetings</h1>

      <section>
        <h2 className="font-medium mb-2">Upcoming meetings</h2>
        <MeetingList meetings={upcoming} emptyLabel="No upcoming meetings scheduled." />
      </section>

      <section>
        <h2 className="font-medium mb-2">Past meetings ({pastTotal})</h2>
        <form className="flex gap-2 text-sm mb-3">
          <input
            name="pastSearch"
            defaultValue={pastSearch}
            placeholder="Search venue or host name"
            className="border border-slate-300 rounded px-3 py-2 bg-white"
          />
          <button type="submit" className="border border-slate-300 rounded px-3 py-2 bg-white hover:bg-slate-50">
            Search
          </button>
        </form>
        <MeetingList meetings={past} emptyLabel="No past meetings on record." />
        <div className="mt-4">
          <Pagination
            page={pastPage}
            totalPages={pastTotalPages}
            basePath="/meetings"
            pageParam="pastPage"
            params={{ pastSearch }}
          />
        </div>
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
