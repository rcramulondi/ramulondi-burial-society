export type CalendarDay = {
  date: Date;
  inCurrentMonth: boolean;
  isToday: boolean;
};

/**
 * Builds a 6-week (42-day), Monday-first grid covering the given month, plus
 * the leading/trailing days from adjacent months needed to fill whole weeks
 * — the standard shape for a month-view calendar. All dates are UTC midnight
 * to match how DateTime columns are stored/compared elsewhere in the app.
 */
export function getMonthGrid(year: number, month: number, today: Date = new Date()): CalendarDay[] {
  const firstOfMonth = new Date(Date.UTC(year, month - 1, 1));
  const firstWeekday = firstOfMonth.getUTCDay(); // 0=Sun..6=Sat
  const offsetToMonday = (firstWeekday + 6) % 7;
  const gridStart = new Date(Date.UTC(year, month - 1, 1 - offsetToMonday));

  const todayUTC = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));

  const days: CalendarDay[] = [];
  for (let i = 0; i < 42; i++) {
    const date = new Date(gridStart.getTime() + i * 86400000);
    days.push({
      date,
      inCurrentMonth: date.getUTCMonth() === month - 1 && date.getUTCFullYear() === year,
      isToday: date.getTime() === todayUTC.getTime(),
    });
  }
  return days;
}

/** Clamps month to 1-12, rolling the year over on either end — for prev/next navigation. */
export function normalizeYearMonth(year: number, month: number): { year: number; month: number } {
  const d = new Date(Date.UTC(year, month - 1, 1));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
}
