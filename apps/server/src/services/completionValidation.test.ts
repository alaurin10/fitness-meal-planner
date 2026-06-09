import { describe, expect, it } from "vitest";
import { parseLocalDate } from "@platform/shared";
import {
  dayKeyInPlanWeek,
  dayLabelForDayKey,
  validateMealCompletion,
} from "./completionValidation.js";

// 2026-06-08 is a Monday.
const WEEK_START = parseLocalDate("2026-06-08");

describe("dayLabelForDayKey", () => {
  it("maps dayKeys to canonical labels", () => {
    expect(dayLabelForDayKey("2026-06-08")).toBe("Mon");
    expect(dayLabelForDayKey("2026-06-10")).toBe("Wed");
    expect(dayLabelForDayKey("2026-06-14")).toBe("Sun");
  });

  it("handles week/month boundaries", () => {
    expect(dayLabelForDayKey("2026-06-30")).toBe("Tue");
    expect(dayLabelForDayKey("2026-07-01")).toBe("Wed");
    expect(dayLabelForDayKey("2026-12-31")).toBe("Thu");
    expect(dayLabelForDayKey("2027-01-01")).toBe("Fri");
  });
});

describe("dayKeyInPlanWeek", () => {
  it("accepts every day inside the 7-day window", () => {
    expect(dayKeyInPlanWeek("2026-06-08", WEEK_START)).toBe(true);
    expect(dayKeyInPlanWeek("2026-06-11", WEEK_START)).toBe(true);
    expect(dayKeyInPlanWeek("2026-06-14", WEEK_START)).toBe(true);
  });

  it("rejects days outside the window", () => {
    expect(dayKeyInPlanWeek("2026-06-07", WEEK_START)).toBe(false);
    expect(dayKeyInPlanWeek("2026-06-15", WEEK_START)).toBe(false);
  });
});

describe("validateMealCompletion", () => {
  const base = {
    dayKey: "2026-06-10",
    weekStartDate: WEEK_START,
    mealCount: 3,
    previousCompletedAt: null,
  };

  it("rejects out-of-bounds indices", () => {
    const result = validateMealCompletion({ ...base, indices: [0, 3] });
    expect(result.ok).toBe(false);
  });

  it("rejects a dayKey outside the plan week", () => {
    const result = validateMealCompletion({
      ...base,
      dayKey: "2026-06-20",
      indices: [0],
    });
    expect(result.ok).toBe(false);
  });

  it("dedupes and sorts indices", () => {
    const result = validateMealCompletion({ ...base, indices: [2, 0, 2, 0] });
    expect(result).toMatchObject({ ok: true, indices: [0, 2] });
  });

  it("sets completedAt only when every meal is covered", () => {
    const partial = validateMealCompletion({ ...base, indices: [0, 1] });
    expect(partial).toMatchObject({ ok: true, completedAt: null });

    const full = validateMealCompletion({ ...base, indices: [0, 1, 2] });
    if (!full.ok) throw new Error("expected ok");
    expect(full.completedAt).toBeInstanceOf(Date);
  });

  it("does not treat duplicate indices as full coverage", () => {
    const result = validateMealCompletion({ ...base, indices: [0, 0, 1, 1] });
    expect(result).toMatchObject({ ok: true, completedAt: null, indices: [0, 1] });
  });

  it("never marks an empty day complete", () => {
    const result = validateMealCompletion({
      ...base,
      mealCount: 0,
      indices: [],
    });
    expect(result).toMatchObject({ ok: true, completedAt: null });
  });

  it("rejects any index on an empty day", () => {
    const result = validateMealCompletion({
      ...base,
      mealCount: 0,
      indices: [0],
    });
    expect(result.ok).toBe(false);
  });

  it("preserves the original completedAt on re-PUT", () => {
    const original = new Date("2026-06-10T08:00:00Z");
    const result = validateMealCompletion({
      ...base,
      indices: [0, 1, 2],
      previousCompletedAt: original,
    });
    if (!result.ok) throw new Error("expected ok");
    expect(result.completedAt).toBe(original);
  });

  it("clears completedAt when a meal is unchecked", () => {
    const result = validateMealCompletion({
      ...base,
      indices: [0, 1],
      previousCompletedAt: new Date(),
    });
    expect(result).toMatchObject({ ok: true, completedAt: null });
  });
});
