import { listMeetings, listPastMeetings, countPastMeetings, createMeetingForm, uploadMeetingNotes } from "@/server/actions/meeting";
import { prisma } from "@/lib/prisma";
import { MEETING_TYPE_LABELS } from "@/lib/statusLabels";
import { formatDate } from "@/lib/format";
import { parsePage, totalPageCount } from "@/lib/pagination";
import ActionForm from "@/components/forms/ActionForm";
import Field from "@/components/forms/Field";
import FieldLabel from "@/components/forms/FieldLabel";
import FormKey from "@/components/forms/FormKey";
import Card from "@/components/ui/Card";
import SearchSelect from "@/components/ui/SearchSelect";
import MeetingCalendar from "@/components/ui/MeetingCalendar";
import Pagination from "@/components/ui/Pagination";

const MEETING_TYPES = ["COMMITTEE_MEETING", "QUARTERLY", "AGM", "SPECIAL_AGM"] as const;

export default async function AdminMeetingsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; pastSearch?: string; pastPage?: string }>;
}) {
  const { month: monthParam, pastSearch, pastPage: pastPageParam } = await searchParams;
  const now = new Date();
  const [yearStr, monthStr] = (monthParam ?? "").split("-");
  const year = Number.isInteger(Number(yearStr)) && yearStr ? Number(yearStr) : now.getUTCFullYear();
  const month = Number.isInteger(Number(monthStr)) && monthStr ? Number(monthStr) : now.getUTCMonth() + 1;
  const pastPage = parsePage(pastPageParam);

  const [meetings, members, past, pastTotal] = await Promise.all([
    listMeetings(),
    prisma.member.findMany({ orderBy: { surname: "asc" } }),
    listPastMeetings({ search: pastSearch, page: pastPage }),
    countPastMeetings({ search: pastSearch }),
  ]);
  const pastTotalPages = totalPageCount(pastTotal, 20);

  const today = new Date();
  const upcoming = meetings.filter((m) => m.date >= today).sort((a, b) => a.date.getTime() - b.date.getTime());

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-xl font-semibold text-navy">Meetings</h1>

      <Card className="max-w-lg">
        <h2 className="font-medium mb-4 text-navy">Schedule a meeting</h2>
        <ActionForm action={createMeetingForm} submitLabel="Schedule meeting" sticky>
          <FormKey />
          <label className="flex flex-col gap-1 text-sm">
            <FieldLabel label="Meeting type" required />
            <select name="type" required className="border border-slate-300 rounded px-3 py-2 bg-white">
              {MEETING_TYPES.map((t) => (
                <option key={t} value={t}>{MEETING_TYPE_LABELS[t]}</option>
              ))}
            </select>
          </label>
          <Field label="Date of meeting" name="date" type="date" required />
          <Field label="Venue" name="venue" required />
          <label className="flex flex-col gap-1 text-sm">
            <FieldLabel label="Host" required />
            <SearchSelect
              name="hostMemberId"
              placeholder="Search by name or membership no"
              required
              options={members.map((m) => ({
                value: m.id,
                label: `${m.firstName} ${m.surname} (${m.membershipNo})`,
              }))}
            />
          </label>
        </ActionForm>
      </Card>

      <Card>
        <h2 className="font-medium mb-4 text-navy">Calendar</h2>
        <MeetingCalendar year={year} month={month} meetings={meetings} basePath="/admin/meetings" />
      </Card>

      <Card>
        <h2 className="font-medium mb-4 text-navy">Upcoming meetings</h2>
        <MeetingList meetings={upcoming} emptyLabel="No upcoming meetings scheduled." />
      </Card>

      <Card>
        <h2 className="font-medium mb-4 text-navy">Past meetings ({pastTotal})</h2>
        <form className="flex gap-2 text-sm mb-4">
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
            basePath="/admin/meetings"
            pageParam="pastPage"
            params={{ pastSearch }}
          />
        </div>
      </Card>
    </div>
  );
}

type MeetingRow = Awaited<ReturnType<typeof listMeetings>>[number];

function MeetingList({ meetings, emptyLabel }: { meetings: MeetingRow[]; emptyLabel: string }) {
  if (meetings.length === 0) {
    return <p className="text-sm text-neutral-500">{emptyLabel}</p>;
  }
  return (
    <div className="flex flex-col gap-4">
      {meetings.map((m) => (
        <div key={m.id} className="border border-slate-200 rounded p-3 text-sm flex flex-col gap-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <p className="font-medium text-navy">{MEETING_TYPE_LABELS[m.type]}</p>
              <p className="text-neutral-500">
                {formatDate(m.date)} &middot; {m.venue} &middot; Hosted by {m.hostMember.firstName} {m.hostMember.surname}
              </p>
            </div>
          </div>

          {m.documents.length > 0 ? (
            <ul className="flex flex-col gap-1">
              {m.documents.map((d) => (
                <li key={d.id}>
                  <a href={`/api/documents/${d.id}`} target="_blank" className="text-accent hover:underline text-xs">
                    {d.fileName}
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <ActionForm action={uploadMeetingNotes} submitLabel="Upload notes" className="flex flex-col gap-2 max-w-xs">
              <input type="hidden" name="meetingId" value={m.id} />
              <label className="flex flex-col gap-1 text-sm">
                <FieldLabel label="Meeting notes / minutes" />
                <input name="file" type="file" accept=".jpg,.jpeg,.png,.pdf" className="text-xs" />
              </label>
            </ActionForm>
          )}
        </div>
      ))}
    </div>
  );
}
