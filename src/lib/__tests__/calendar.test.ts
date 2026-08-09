import { describe, it, expect } from "vitest";
import { getMonthGrid, normalizeYearMonth } from "../calendar";

describe("getMonthGrid", () => {
  it("always returns a 42-day (6-week) grid", () => {
    expect(getMonthGrid(2026, 2)).toHaveLength(42);
    expect(getMonthGrid(2026, 8)).toHaveLength(42);
  });

  it("always starts on a Monday", () => {
    for (const [y, m] of [[2026, 1], [2026, 2], [2026, 8], [2024, 12]] as const) {
      expect(getMonthGrid(y, m)[0].date.getUTCDay()).toBe(1);
    }
  });

  it("marks every day of the target month as inCurrentMonth, matching the month's real day count", () => {
    const grid = getMonthGrid(2026, 2); // Feb 2026 — 28 days
    const inMonth = grid.filter((d) => d.inCurrentMonth);
    expect(inMonth).toHaveLength(28);
    expect(inMonth[0].date.getUTCDate()).toBe(1);
    expect(inMonth[27].date.getUTCDate()).toBe(28);
  });

  it("handles a 31-day month and leap-year February", () => {
    expect(getMonthGrid(2026, 1).filter((d) => d.inCurrentMonth)).toHaveLength(31);
    expect(getMonthGrid(2024, 2).filter((d) => d.inCurrentMonth)).toHaveLength(29); // 2024 is a leap year
  });

  it("flags today correctly when supplied", () => {
    const today = new Date(Date.UTC(2026, 1, 15));
    const grid = getMonthGrid(2026, 2, today);
    const todayCell = grid.find((d) => d.isToday);
    expect(todayCell?.date.getUTCDate()).toBe(15);
  });

  it("has no isToday match when today falls outside the grid", () => {
    const today = new Date(Date.UTC(2030, 0, 1));
    const grid = getMonthGrid(2026, 2, today);
    expect(grid.some((d) => d.isToday)).toBe(false);
  });
});

describe("normalizeYearMonth", () => {
  it("rolls forward past December into the next year", () => {
    expect(normalizeYearMonth(2026, 13)).toEqual({ year: 2027, month: 1 });
  });

  it("rolls backward past January into the previous year", () => {
    expect(normalizeYearMonth(2026, 0)).toEqual({ year: 2025, month: 12 });
  });

  it("leaves an in-range month unchanged", () => {
    expect(normalizeYearMonth(2026, 6)).toEqual({ year: 2026, month: 6 });
  });
});
