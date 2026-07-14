import { describe, expect, it } from "vitest";
import { pickLatestWeighInPerDay } from "./client.js";

describe("pickLatestWeighInPerDay", () => {
  it("keeps only the highest-samplePk (latest) sample for a day with multiple readings", () => {
    // Real-world case: a smart scale sent a preliminary reading (195 lbs) 8
    // seconds before the final, settled one (165 lbs) — same calendar day.
    const metrics = [
      { samplePk: 1782768628292, weight: 88450, calendarDate: "2026-06-29" }, // ~195 lbs, earlier
      { samplePk: 1782768636346, weight: 74842, calendarDate: "2026-06-29" }, // ~165 lbs, later
    ];

    const result = pickLatestWeighInPerDay(metrics);

    expect(result).toEqual([
      { samplePk: 1782768636346, dayKey: "2026-06-29", weightGrams: 74842 },
    ]);
  });

  it("is order-independent — the later samplePk wins regardless of array order", () => {
    const metrics = [
      { samplePk: 1782768636346, weight: 74842, calendarDate: "2026-06-29" },
      { samplePk: 1782768628292, weight: 88450, calendarDate: "2026-06-29" },
    ];

    const result = pickLatestWeighInPerDay(metrics);

    expect(result).toEqual([
      { samplePk: 1782768636346, dayKey: "2026-06-29", weightGrams: 74842 },
    ]);
  });

  it("keeps one entry per distinct day", () => {
    const metrics = [
      { samplePk: 1, weight: 74000, calendarDate: "2026-06-28" },
      { samplePk: 2, weight: 74500, calendarDate: "2026-06-29" },
    ];

    const result = pickLatestWeighInPerDay(metrics);

    expect(result).toHaveLength(2);
    expect(result.map((r) => r.dayKey).sort()).toEqual(["2026-06-28", "2026-06-29"]);
  });

  it("filters out entries missing samplePk, weight, or calendarDate", () => {
    const metrics = [
      { samplePk: undefined, weight: 74000, calendarDate: "2026-06-29" },
      { samplePk: 1, weight: undefined, calendarDate: "2026-06-29" },
      { samplePk: 1, weight: 74000, calendarDate: undefined },
    ];

    expect(pickLatestWeighInPerDay(metrics)).toEqual([]);
  });

  it("returns an empty array for no metrics", () => {
    expect(pickLatestWeighInPerDay([])).toEqual([]);
  });
});
