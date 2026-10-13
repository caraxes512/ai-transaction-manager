import { describe, expect, it } from "vitest";
import { currentMonth, inr, monthLabel, shiftMonth, shortDate, sourceLabel } from "../lib/format";

describe("inr", () => {
  it("uses Indian digit grouping and drops .00", () => {
    expect(inr("10240")).toBe("₹10,240");
    expect(inr("1234567.5")).toBe("₹12,34,567.50");
    expect(inr("450.00")).toBe("₹450");
    expect(inr("-2000")).toBe("-₹2,000");
  });
  it("shows a dash for missing values", () => {
    expect(inr(null)).toBe("—");
    expect(inr(undefined)).toBe("—");
    expect(inr("abc")).toBe("—");
  });
});

describe("months", () => {
  it("shifts across year boundaries", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-10", 0)).toBe("2026-10");
  });
  it("formats", () => {
    expect(currentMonth(new Date(2026, 9, 7))).toBe("2026-10");
    expect(monthLabel("2026-10")).toBe("October 2026");
    expect(monthLabel("2026-09", true)).toBe("Sep");
  });
});

it("describes how a category was chosen", () => {
  expect(sourceLabel(null, null)).toBe("Needs a category");
  expect(sourceLabel("user", 1)).toBe("Set by you");
  expect(sourceLabel("rule", 0.9)).toBe("AI (rule) 90%");
});

it("shortens dates, adding the year only when it isn't this year", () => {
  const now = new Date(2026, 9, 8);
  expect(shortDate("2026-10-06", now)).toBe("6 Oct");
  expect(shortDate("2025-12-31", now)).toBe("31 Dec 2025");
});
