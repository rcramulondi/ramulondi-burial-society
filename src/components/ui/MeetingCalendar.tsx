import Link from "next/link";
import { getMonthGrid, normalizeYearMonth } from "@/lib/calendar";
import { MEETING_TYPE_LABELS } from "@/lib/statusLabels";
import type { MeetingType } from "@prisma/client";

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTH_LABELS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function monthParam(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

/** Server-rendered month-grid calendar — navigation is plain links (?month=YYYY-MM), no client JS needed. */
export default function MeetingCalendar({
  year,
  month,
  meetings,
  basePath,
}: {
  year: number;
  month: number;
  meetings: { id: string; date: Date; type: MeetingType }[];
  basePath: string;
}) {
  const grid = getMonthGrid(year, month);

  const meetingsByDay = new Map<string, typeof meetings>();
  for (const m of meetings) {
    const key = m.date.toISOString().slice(0, 10);
    meetingsByDay.set(key, [...(meetingsByDay.get(key) ?? []), m]);
  }

  const prev = normalizeYearMonth(year, month - 1);
  const next = normalizeYearMonth(year, month + 1);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <Link href={`${basePath}?month=${monthParam(prev.year, prev.month)}`} className="text-sm text-accent hover:underline">
          &larr; Prev
        </Link>
        <h3 className="font-medium text-navy">{MONTH_LABELS[month - 1]} {year}</h3>
        <Link href={`${basePath}?month=${monthParam(next.year, next.month)}`} className="text-sm text-accent hover:underline">
          Next &rarr;
        </Link>
      </div>
      <div className="grid grid-cols-7 gap-px bg-border border border-border overflow-hidden rounded text-xs">
        {WEEKDAY_LABELS.map((d) => (
          <div key={d} className="bg-background py-1 text-center font-medium text-text-muted">
            {d}
          </div>
        ))}
        {grid.map((day) => {
          const key = day.date.toISOString().slice(0, 10);
          const dayMeetings = meetingsByDay.get(key) ?? [];
          return (
            <div
              key={key}
              className={`bg-card min-h-[68px] p-1 flex flex-col gap-0.5 ${!day.inCurrentMonth ? "opacity-40" : ""}`}
            >
              <span className={day.isToday ? "font-bold text-accent" : "text-text-muted"}>
                {day.date.getUTCDate()}
              </span>
              {dayMeetings.map((m) => (
                <span
                  key={m.id}
                  className="truncate rounded bg-primary-light text-accent px-1 py-0.5"
                  title={MEETING_TYPE_LABELS[m.type]}
                >
                  {MEETING_TYPE_LABELS[m.type]}
                </span>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
