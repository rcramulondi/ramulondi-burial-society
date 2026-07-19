import { describe, it, expect } from "vitest";
import { deriveMemberStatus } from "../memberStatus";

const FULL_RATE = 80;

function baseInput(overrides: Partial<Parameters<typeof deriveMemberStatus>[0]> = {}) {
  return {
    deceasedDate: null,
    dateJoined: new Date(Date.UTC(2020, 0, 1)),
    reinstatementDate: null,
    today: new Date(Date.UTC(2026, 6, 15)), // 15 July 2026
    fullRateFor: () => FULL_RATE,
    paidAmountFor: () => FULL_RATE,
    lastMonthWithAnyPayment: () => ({ year: 2026, month: 7 }),
    lapseMonths: 6,
    warningMonths: 3,
    ...overrides,
  };
}

describe("deriveMemberStatus", () => {
  it("is DECEASED whenever deceasedDate is set, regardless of payments", () => {
    const result = deriveMemberStatus(baseInput({ deceasedDate: new Date(Date.UTC(2026, 5, 1)) }));
    expect(result.status).toBe("DECEASED");
    expect(result.terminationDate).toBeNull();
  });

  it("is ACTIVE when every elapsed month this year is fully paid", () => {
    const result = deriveMemberStatus(baseInput());
    expect(result.status).toBe("ACTIVE");
  });

  it("does not penalize a member who joined mid-year for months before they joined", () => {
    const result = deriveMemberStatus(
      baseInput({
        dateJoined: new Date(Date.UTC(2026, 6, 1)), // joined July 2026
        paidAmountFor: (year, month) => (month === 7 ? FULL_RATE : 0),
        lastMonthWithAnyPayment: () => ({ year: 2026, month: 7 }),
      })
    );
    expect(result.status).toBe("ACTIVE");
  });

  it("is ABOUT_TO_LAPSE once the unpaid gap exceeds the warning threshold", () => {
    // Joined Jan 2026, paid only Jan-Feb (2 months), today is July (7 months elapsed) -> gap 5, > warning(3), < lapse(6)
    const result = deriveMemberStatus(
      baseInput({
        paidAmountFor: (year, month) => (month <= 2 ? FULL_RATE : 0),
        lastMonthWithAnyPayment: () => ({ year: 2026, month: 2 }),
      })
    );
    expect(result.status).toBe("ABOUT_TO_LAPSE");
  });

  it("is IN_ACTIVE once the gap reaches the lapse threshold and 6 months have passed since last payment", () => {
    // Last payment Jan 2026; today is July 2026 (6 months later) -> lapse termination date <= today
    const result = deriveMemberStatus(
      baseInput({
        paidAmountFor: (year, month) => (month === 1 ? FULL_RATE : 0),
        lastMonthWithAnyPayment: () => ({ year: 2026, month: 1 }),
        today: new Date(Date.UTC(2026, 6, 1)), // 1 July 2026 = exactly 6 months after Jan
      })
    );
    expect(result.status).toBe("IN_ACTIVE");
    expect(result.terminationDate).not.toBeNull();
  });

  it("stays ABOUT_TO_LAPSE when the gap is large but the 6-month grace window since last payment hasn't elapsed yet", () => {
    const result = deriveMemberStatus(
      baseInput({
        paidAmountFor: (year, month) => (month === 5 ? FULL_RATE : 0),
        lastMonthWithAnyPayment: () => ({ year: 2026, month: 5 }),
        today: new Date(Date.UTC(2026, 6, 15)), // only ~2.5 months after last payment
      })
    );
    // gap here: monthsElapsed=7, fullyPaid=1 -> gap=6 >= lapseMonths(6), but termination candidate (Nov 2026) is in the future
    expect(result.status).toBe("ABOUT_TO_LAPSE");
    expect(result.terminationDate).toBeNull();
  });

  it("treats a member joining later this year (future join date) as ACTIVE", () => {
    const result = deriveMemberStatus(
      baseInput({ dateJoined: new Date(Date.UTC(2026, 11, 1)) }) // joins December, today is July
    );
    expect(result.status).toBe("ACTIVE");
  });

  it("uses the reinstatement date instead of the original join date when set", () => {
    const result = deriveMemberStatus(
      baseInput({
        dateJoined: new Date(Date.UTC(2015, 0, 1)),
        reinstatementDate: new Date(Date.UTC(2026, 5, 1)), // reinstated June 2026
        paidAmountFor: (year, month) => (month === 6 || month === 7 ? FULL_RATE : 0),
        lastMonthWithAnyPayment: () => ({ year: 2026, month: 7 }),
      })
    );
    expect(result.status).toBe("ACTIVE");
  });
});
